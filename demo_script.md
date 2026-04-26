# 🚀 Nebula Demo Script (Dev Tool Track)

## The Problem
"As developers, we waste countless hours hoarding assets, undocumented scripts, and downloaded images. Current AI coding assistants can write code, but they are completely blind to our actual workspace structure and visual assets. If you want to use an AI to organize your workspace, you can't — because the moment you move a file, your local vector database breaks."

## The "Wow" Factors (Why this wins a Dev Tool track)
1. **Multimodal Agentic Actions**: Nebula doesn't just read code; it uses Gemini 2.5 Flash to *visually* inspect images and PDFs, then autonomously executes file system operations (renaming, organizing) based on semantic understanding.
2. **Auto-Healing Vector State**: Nebula maintains a tightly coupled LangGraph agent and MongoDB Atlas vector database. When the agent moves or renames a file, it instantly patches the vector database in real-time. Your search index is never stale.
3. **Reversible Actions**: Complete safety via an atomic Undo stack.

---

## 🎬 The Demo Flow (3 Minutes)

### Phase 1: The Messy Workspace
* **Setup:** Have a project open with a folder called `assets/` full of poorly named images (e.g., `download (1).jpeg`, `screenshot_449.png`, `IMG_9912.jpg`).
* **Speaker:** "Here's a standard developer nightmare. A folder full of completely unsearchable, poorly named assets. Let's ask Nebula to clean this up."
* **Action:** Type into Nebula: *"Look at the images in the assets folder and rename them to accurately describe what's inside them."*

### Phase 2: The Agentic "Wow" Moment
* **What happens on screen:** 
  1. The audience sees Nebula run the `list_directory` tool to find the messy files.
  2. Nebula runs the `ask_about_files` tool, feeding the raw image bytes to Gemini Multimodal.
  3. Nebula runs the `rename_file` tool to rename them to things like `react_architecture_diagram.png` or `landing_page_mockup.jpeg`.
* **Speaker:** "Nebula just listed the directory, visually inspected every single image using Gemini Multimodal, and renamed them semantically on disk. No manual tagging required."

### Phase 3: The Architecture "Wow" Moment
* **Action:** Type into Nebula: *"Undo that last action."*
* **What happens on screen:** Nebula reverts the files back to `download (1).jpeg`.
* **Speaker:** "Because Nebula is built with a LangGraph state machine, it maintains an atomic undo stack for every filesystem operation. But here is the real magic..."
* **Action:** Type into Nebula: *"Actually, rename them again. Then, find the picture of the React architecture."*
* **Speaker:** "When Nebula renamed those files, it didn't just update the file system. It automatically executed a `$set` operation on our MongoDB Atlas vector database. The vector embeddings instantly tracked the new file paths without requiring a heavy re-indexing step. The agent stays perfectly in sync with the filesystem."

### Phase 4: The Final Pitch
* **Speaker:** "Nebula is more than a chat window. It's a deeply integrated, multimodal, self-healing file manager that finally brings agentic AI to workspace organization."
