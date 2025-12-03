# Fix for NumPy Installation Error on Python 3.14

## Problem

You're encountering an error when installing NumPy because:
1. **Python 3.14.1 is very new** (released October 2024)
2. Most packages (including NumPy) don't have pre-built wheels for Python 3.14 yet
3. pip tries to build from source, which requires a C compiler
4. Your system doesn't have a C compiler installed

## Solutions

### ✅ **Solution 1: Use Python 3.11 or 3.12 (RECOMMENDED)**

This is the **best solution** because:
- Python 3.11/3.12 are stable and widely supported
- All packages have pre-built wheels
- Your Dockerfile already uses Python 3.11
- No compiler needed

**Steps:**

1. **Install Python 3.11 or 3.12:**
   - Download from: https://www.python.org/downloads/
   - During installation, check "Add Python to PATH"

2. **Recreate your virtual environment:**
   ```powershell
   # Remove old venv
   Remove-Item -Recurse -Force venv
   
   # Create new venv with Python 3.11/3.12
   python3.11 -m venv venv
   # OR
   python3.12 -m venv venv
   
   # Activate it
   venv\Scripts\activate
   
   # Upgrade pip
   python -m pip install --upgrade pip setuptools wheel
   
   # Install requirements
   pip install -r requirements.txt
   ```

### ⚙️ **Solution 2: Install Visual Studio Build Tools**

If you must use Python 3.14, install a C compiler:

1. **Download Visual Studio Build Tools:**
   - Visit: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
   - Download "Build Tools for Visual Studio 2022"

2. **Install with C++ workload:**
   - Run the installer
   - Select "Desktop development with C++" workload
   - Install (this is a large download ~6GB)

3. **Restart your terminal and try again:**
   ```powershell
   pip install -r requirements.txt
   ```

### 🔄 **Solution 3: Use Conda**

Conda handles compilers automatically:

1. **Install Miniconda or Anaconda:**
   - Download from: https://docs.conda.io/en/latest/miniconda.html

2. **Create environment:**
   ```powershell
   conda create -n neo_store python=3.11
   conda activate neo_store
   conda install pip
   pip install -r requirements.txt
   ```

## Recommendation

**Use Solution 1 (Python 3.11 or 3.12)** because:
- ✅ Easiest and fastest
- ✅ No large downloads
- ✅ Most compatible with your project
- ✅ Matches your Docker setup

## Current Status

I've updated your `requirements.txt` to use:
- `numpy>=2.0.0` (instead of unpinned)
- `pandas>=2.2.0` (instead of unpinned)

However, these still won't install on Python 3.14 without a compiler.

## Next Steps

1. Choose a solution above
2. If using Solution 1, recreate your venv with Python 3.11/3.12
3. Run `pip install -r requirements.txt` again

