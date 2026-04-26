import os
import magic
from google import genai
from google.genai import types
from google.api_core import exceptions

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def get_multimodal_embedding(file_path, description=None, task_type="RETRIEVAL_DOCUMENT"):
    """
    Sends raw file bytes (PDF, Image, Text) directly to Gemini 2 
    without manual extraction.
    """
    mime_type = magic.from_file(file_path, mime=True)
    content_parts = []
    
    if description:
        content_parts.append(description)

    # Gemini's embed_content rejects text/* via Part.from_bytes — it wants the text in
    # the text field. Read text-like files as a string and append directly.
    is_text = (
        mime_type.startswith("text/") or 
        mime_type in {
            "application/json", "application/xml", "application/x-yaml",
            "application/x-sh", "application/javascript", "application/typescript",
            "application/x-httpd-php", "application/sql", "application/toml",
            "application/wasm", "application/x-perl", "application/x-ruby",
            "application/x-swift", "application/x-kotlin", "application/x-python",
            "application/x-rust", "application/x-go",
        }
    )
    try:
        if mime_type.startswith("image/"):
            # Multimodal embeddings for text+image often have lower text-to-mixed similarity
            # than text-to-text. Embedding the description as pure text ensures it ranks high.
            if description:
                content_parts = [description]
                print(f"Prepared {mime_type} as pure text description for embedding: {os.path.basename(file_path)}")
            else:
                with open(file_path, "rb") as f:
                    file_bytes = f.read()
                file_part = types.Part.from_bytes(data=file_bytes, mime_type=mime_type)
                content_parts = [file_part]
                print(f"Prepared {mime_type} for direct embedding (no description): {os.path.basename(file_path)}")
        elif is_text:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    text = f.read()[:10000]
            except UnicodeDecodeError:
                with open(file_path, "r", encoding="latin-1") as f:
                    text = f.read()[:10000]
            content_parts.append(text)
            print(f"Prepared {mime_type} as text for embedding: {os.path.basename(file_path)}")
        else:
            with open(file_path, "rb") as f:
                file_bytes = f.read()
            file_part = types.Part.from_bytes(
                data=file_bytes,
                mime_type=mime_type
            )
            content_parts.append(file_part)
            print(f"Prepared {mime_type} for direct embedding: {os.path.basename(file_path)}")

    except Exception as e:
        print(f"Error reading file: {e}")
        return None

    try:
        res = client.models.embed_content(
            model="gemini-embedding-2-preview",
            contents=content_parts,
            config={
                'task_type': task_type,
                'output_dimensionality': 768
            }
        )
        return res.embeddings[0].values
    except exceptions.InvalidArgument as e:
        print(f"Validation Error: Ensure the model supports {mime_type}. Error: {e}")
        return None
    except Exception as e:
        print(f"General Error: {e}")
        return None

def get_query_embedding(query_text):
    """
    Converts a query to a vector.
    """
    try:
        res = client.models.embed_content(
            model="gemini-embedding-2-preview",
            contents=query_text,
            config={
                'task_type': 'RETRIEVAL_QUERY',
                'output_dimensionality': 768
            }
        )
        return res.embeddings[0].values
    except Exception as e:
        print(f"Error embedding query: {e}")
        return None