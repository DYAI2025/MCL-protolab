# /// script
# dependencies = ["gradio_client"]
# ///
"""Image -> textured GLB via the microsoft/TRELLIS.2 Hugging Face Space.

Free path (ZeroGPU quota via HF_TOKEN) for turning V2 concept-art crops into
3D candidate models. TRELLIS.2 is MIT-licensed; generated output carries no
service-side usage restriction, but every result still enters the asset
registry as status=candidate for review (docs/assets/ART_DIRECTION.md).

Usage:
  HF_TOKEN=... uv run scripts/image-to-3d/trellis.py <input-image> <output.glb> [seed] [resolution]
"""

import sys
from pathlib import Path
from shutil import copyfile

from gradio_client import Client, handle_file

def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    image_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    seed = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    resolution = sys.argv[4] if len(sys.argv) > 4 else "1024"
    if not image_path.exists():
        print(f"input not found: {image_path}")
        return 2

    client = Client("microsoft/TRELLIS.2")
    client.predict(api_name="/start_session")
    print(f"session started; preprocessing {image_path.name}", flush=True)
    client.predict(input=handle_file(str(image_path)), api_name="/preprocess_image")

    print(f"generating (seed={seed}, resolution={resolution}) — ZeroGPU, takes minutes", flush=True)
    client.predict(
        image=handle_file(str(image_path)),
        seed=seed,
        resolution=resolution,
        api_name="/image_to_3d",
    )

    # Space enforces a 100k minimum decimation target; mesh optimization for
    # runtime budgets happens later, review candidates ship as-is.
    print("extracting GLB (decimation 100k, texture 1024)", flush=True)
    extracted, download = client.predict(
        decimation_target=100000,
        texture_size=1024,
        api_name="/extract_glb",
    )
    src = Path(download or extracted)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    copyfile(src, out_path)
    print(f"written: {out_path} ({out_path.stat().st_size} bytes)")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
