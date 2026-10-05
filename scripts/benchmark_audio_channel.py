"""Measure random-payload LDPC candidates; saves raw counts, CSV and SVG."""
import argparse
import csv
from pathlib import Path
import sys
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "interactives/audio-channel-coding"))
from model import CodeParameters, LDPC, SEED, transmit

CANDIDATES = [CodeParameters(1024, 3072, 20), CodeParameters(2048, 6144, 30),
              CodeParameters(2048, 8192, 40)]


def main():
    parser = argparse.ArgumentParser(__doc__)
    parser.add_argument("--frames", type=int, default=128)
    parser.add_argument("--output", type=Path, default=ROOT / "docs/audio-channel-coding")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    rows = []
    for p in CANDIDATES:
        codec = LDPC(p)
        bits = np.random.Generator(np.random.PCG64(SEED + 100)).integers(0, 2, args.frames * p.k, dtype=np.uint8)
        for snr in [-6, -5, -4, -3, -2.5, -2, -1.75, -1.5, -1.25, -1, -.5, 0, 1, 2, 4]:
            _, metrics = transmit(bits, snr, codec, SEED + 200)
            row = {"k": p.k, "n": p.n, "iterations": p.iterations, "snr_db": snr, **metrics}
            rows.append(row)
            print(f"k={p.k} n={p.n} BP={p.iterations} SNR={snr:g}: BER={metrics['post_ber']:.6g}, FER={metrics['fer']:.4g}", flush=True)
    with (args.output / "benchmark.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    import matplotlib
    matplotlib.use("Agg")
    matplotlib.rcParams["svg.hashsalt"] = "audio-channel-coding"
    import matplotlib.pyplot as plt
    fig, axes = plt.subplots(1, 2, figsize=(11, 4), constrained_layout=True)
    for p in CANDIDATES:
        curve = [r for r in rows if (r["k"], r["n"], r["iterations"]) == (p.k, p.n, p.iterations)]
        label = f"k={p.k}, R={p.rate:.3f}, {p.iterations} BP"
        for ax, key in zip(axes, ["post_ber", "fer"]):
            floor = 1 / (args.frames * p.k) if key == "post_ber" else 1 / args.frames
            ax.semilogy([r["snr_db"] for r in curve], [max(r[key], floor / 2) for r in curve], "o-", label=label)
            ax.set(xlabel="SNR = signal power / noise power (dB)", ylabel=key, title=key)
            ax.grid(True, which="both", alpha=.3)
    axes[0].legend(fontsize=8)
    fig.suptitle(f"Random payload, fixed seed, {args.frames} frames/point; zero errors plotted below 1/N")
    plot = args.output / "benchmark.svg"
    fig.savefig(plot, metadata={"Date": None})
    # Matplotlib writes spaces at SVG path line endings; keep diffs clean.
    plot.write_text("\n".join(line.rstrip() for line in plot.read_text(encoding="utf-8").splitlines()) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
