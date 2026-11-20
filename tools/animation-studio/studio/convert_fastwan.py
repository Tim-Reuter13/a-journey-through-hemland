"""Convert the FastWan 2.2 5B transformer (diffusers layout) to the original Wan layout ComfyUI loads.

ComfyUI\\venv\\Scripts\\python.exe studio\\convert_fastwan.py <diffusers transformer.safetensors> <out.safetensors>
"""
import re
import sys

from safetensors import safe_open
from safetensors.torch import save_file

RULES = [
    (r"^condition_embedder\.time_embedder\.linear_1\.", "time_embedding.0."),
    (r"^condition_embedder\.time_embedder\.linear_2\.", "time_embedding.2."),
    (r"^condition_embedder\.time_proj\.", "time_projection.1."),
    (r"^condition_embedder\.text_embedder\.linear_1\.", "text_embedding.0."),
    (r"^condition_embedder\.text_embedder\.linear_2\.", "text_embedding.2."),
    (r"^condition_embedder\.image_embedder\.", "img_emb."),
    (r"\.attn1\.to_q\.", ".self_attn.q."), (r"\.attn1\.to_k\.", ".self_attn.k."),
    (r"\.attn1\.to_v\.", ".self_attn.v."), (r"\.attn1\.to_out\.0\.", ".self_attn.o."),
    (r"\.attn1\.norm_q\.", ".self_attn.norm_q."), (r"\.attn1\.norm_k\.", ".self_attn.norm_k."),
    (r"\.attn2\.to_q\.", ".cross_attn.q."), (r"\.attn2\.to_k\.", ".cross_attn.k."),
    (r"\.attn2\.to_v\.", ".cross_attn.v."), (r"\.attn2\.to_out\.0\.", ".cross_attn.o."),
    (r"\.attn2\.norm_q\.", ".cross_attn.norm_q."), (r"\.attn2\.norm_k\.", ".cross_attn.norm_k."),
    (r"\.attn2\.add_k_proj\.", ".cross_attn.k_img."), (r"\.attn2\.add_v_proj\.", ".cross_attn.v_img."),
    (r"\.attn2\.norm_added_k\.", ".cross_attn.norm_k_img."),
    (r"\.norm2\.", ".norm3."),
    (r"\.ffn\.net\.0\.proj\.", ".ffn.0."), (r"\.ffn\.net\.2\.", ".ffn.2."),
    (r"^blocks\.(\d+)\.scale_shift_table$", r"blocks.\1.modulation"),
    (r"^scale_shift_table$", "head.modulation"),
    (r"^proj_out\.", "head.head."),
]


def convert(key):
    for pat, rep in RULES:
        key = re.sub(pat, rep, key)
    return key


def main(src, dst):
    out = {}
    with safe_open(src, framework="pt") as f:
        for k in f.keys():
            nk = convert(k)
            t = f.get_tensor(k)
            if nk.endswith("modulation") and t.dim() == 3 and nk.startswith("blocks."):
                pass   # (1, 6, dim) in both layouts
            out[nk] = t
    unknown = [k for k in out if any(s in k for s in ("attn1", "attn2", "condition_embedder", "ffn.net", "proj_out"))]
    if unknown:
        raise SystemExit(f"unconverted keys: {unknown[:10]}")
    save_file(out, dst)
    print("CONVERTED", len(out), "tensors ->", dst)


main(sys.argv[1], sys.argv[2])
