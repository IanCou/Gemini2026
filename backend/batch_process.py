import os
import concurrent.futures
from add_element import process_and_embed_file, bulk_upsert_documents

TARGET_DIRECTORY = "/Users/william/yhacks_s26/test_directory"
EXCLUDED_SUFFIXES = ('.mp4', '.zip', '.csv', '.tar.gz', '.min.js', 'package-lock.json')

def process_directory(directory_path):
    """
    Recursively finds all files in a directory and adds them 
    to the vector database using concurrent execution.
    """
    if not os.path.exists(directory_path):
        print(f"Error: Directory '{directory_path}' does not exist.")
        return

    print(f"Starting batch ingestion for: {os.path.abspath(directory_path)}")
    
    filepaths = []
    for root, dirs, files in os.walk(directory_path):
        if '.git' in dirs:
            dirs.remove('.git')

        for file in files:
            if file.startswith('.'):
                continue
                
            if file.lower().endswith(EXCLUDED_SUFFIXES):
                print(f"Skipping excluded file: {file}")
                continue

            file_path = os.path.join(root, file)
            filepaths.append(file_path)

    results = []
    print(f"Total files found: {len(filepaths)}")

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(process_and_embed_file, fp): fp for fp in filepaths}
        for future in concurrent.futures.as_completed(futures):
            try:
                doc = future.result()
                if doc:
                    results.append(doc)
            except Exception as e:
                print(f"Failed to process {futures[future]}: {e}")

    print(f"Successfully generated embeddings for {len(results)} new/changed files.")
    
    if results:
        print("Performing bulk upsert to MongoDB...")
        bulk_upsert_documents(results)
    
    print("Ingestion complete.")

if __name__ == "__main__":
    process_directory(TARGET_DIRECTORY)