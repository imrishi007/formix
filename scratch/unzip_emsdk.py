import zipfile
import os
import time
import shutil

zip_path = r"C:\Users\Rishi\Desktop\Foxmix\formix\scratch\emsdk\downloads\004876f1984e18a9eb0736c5ca417ac86d386fb8-wasm-binaries.zip"
extract_temp = r"C:\Users\Rishi\Desktop\Foxmix\formix\scratch\emsdk\unzip_temp"
target_dir = r"C:\Users\Rishi\Desktop\Foxmix\formix\scratch\emsdk\upstream"

print("Opening zip file...")
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    namelist = zip_ref.namelist()
    print(f"Total files in zip: {len(namelist)}")
    print("First 10 files:")
    for name in namelist[:10]:
        print("  ", name)

# Let's clean up existing target and temp dirs first
for d in [extract_temp, target_dir]:
    if os.path.exists(d):
        print(f"Removing {d}...")
        try:
            shutil.rmtree(d)
        except Exception as e:
            print(f"Error removing {d}: {e}")

print("Extracting directly to target_dir with retry on lock...")
os.makedirs(target_dir, exist_ok=True)

with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    for member in zip_ref.infolist():
        # The zip contains files starting with 'install/'
        # We want to strip the 'install/' prefix and put them directly in target_dir (upstream)
        filename = member.filename
        if filename.startswith("install/"):
            rel_path = filename[len("install/"):]
        else:
            rel_path = filename
        
        if not rel_path:
            continue
            
        dest_path = os.path.join(target_dir, rel_path)
        
        if member.is_dir():
            os.makedirs(dest_path, exist_ok=True)
            continue
            
        # Ensure parent dir exists
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        
        # Extract file with retries
        for attempt in range(10):
            try:
                with zip_ref.open(member) as source, open(dest_path, "wb") as target:
                    shutil.copyfileobj(source, target)
                break
            except (PermissionError, OSError) as e:
                print(f"Lock encountered on {rel_path} (attempt {attempt+1}/10): {e}")
                time.sleep(1.0)
        else:
            raise RuntimeError(f"Failed to extract {rel_path} after 10 attempts.")

print("Extraction completed successfully!")
