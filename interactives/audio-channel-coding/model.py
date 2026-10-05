"""Offline numerical model. Every mode uses signal-power / noise-power SNR."""
from dataclasses import dataclass
import math
import numpy as np

SEED = 20261002
SAMPLE_RATE = 8000
SAMPLES = 32768


def synthesize(samples=SAMPLES, sample_rate=SAMPLE_RATE):
    """Eight windowed three-sine chords; silent boundaries make a clean loop."""
    frequencies = [261.6256, 329.6276, 391.9954, 523.2511,
                   440.0, 391.9954, 329.6276, 293.6648]
    result = np.zeros(samples, dtype=np.float64)
    for indices, frequency in zip(np.array_split(np.arange(samples), 8), frequencies):
        t = np.arange(len(indices)) / sample_rate
        envelope = np.sin(np.pi * np.arange(len(indices)) / (len(indices) - 1)) ** 2
        chord = sum(a * np.sin(2 * np.pi * frequency * ratio * t)
                    for a, ratio in [(1, 1), (.45, 1.25), (.3, 1.5)])
        result[indices] = envelope * chord
    return (result * .85 / np.max(np.abs(result))).astype(np.float32)


def pcm_encode(audio):
    """Uniform unsigned 8-bit PCM, endpoints -1 and +1, MSB first."""
    return np.rint((np.clip(audio, -1, 1) + 1) * 127.5).astype(np.uint8)


def pcm_decode(pcm):
    return np.asarray(pcm, dtype=np.float32) / 127.5 - 1


def pcm_to_bits(pcm):
    return np.unpackbits(np.asarray(pcm, dtype=np.uint8), bitorder="big")


def bits_to_pcm(bits):
    bits = np.asarray(bits, dtype=np.uint8)
    if bits.size % 8:
        raise ValueError("PCM bit count must be a multiple of eight")
    return np.packbits(bits, bitorder="big")


def bpsk(bits):
    return 1 - 2 * np.asarray(bits, dtype=np.float32)


def hard_decision(received):
    return (np.asarray(received) < 0).astype(np.uint8)


def digital_variance(snr_db):
    # Real BPSK symbols are +/-1, so mean(symbol**2)=1.
    return 10 ** (-float(snr_db) / 10)


def analog_variance(audio, snr_db):
    return float(np.mean(np.asarray(audio, dtype=np.float64) ** 2)) * 10 ** (-float(snr_db) / 10)


def channel(signal, variance, seed=SEED):
    if variance < 0:
        raise ValueError("Noise variance must be nonnegative")
    noise = np.random.Generator(np.random.PCG64(seed)).standard_normal(np.shape(signal))
    return (signal + math.sqrt(variance) * noise).astype(np.float32)


def errors(expected, actual):
    mismatch = np.asarray(expected) != np.asarray(actual)
    if mismatch.ndim != 2:
        raise ValueError("Metrics require complete frames")
    bit_errors = int(mismatch.sum())
    frame_errors = int(np.any(mismatch, axis=1).sum())
    return {"ber": bit_errors / mismatch.size, "fer": frame_errors / len(mismatch),
            "bit_errors": bit_errors, "frame_errors": frame_errors,
            "bits": int(mismatch.size), "frames": len(mismatch)}


@dataclass(frozen=True)
class CodeParameters:
    k: int = 2048
    n: int = 6144
    iterations: int = 30

    @property
    def rate(self):
        return self.k / self.n


class LDPC:
    """Actual Sionna 5G rate-matched LDPC with soft boxplus-phi BP decoding."""
    def __init__(self, parameters=CodeParameters()):
        import torch
        from sionna.phy.fec.ldpc import LDPC5GEncoder, LDPC5GDecoder
        torch.set_num_threads(4)
        torch.use_deterministic_algorithms(True)
        self.torch = torch
        self.parameters = parameters
        self.encoder = LDPC5GEncoder(parameters.k, parameters.n, device="cpu")
        self.decoder = LDPC5GDecoder(self.encoder, num_iter=parameters.iterations,
                                    cn_update="boxplus-phi", device="cpu")

    def encode(self, frames):
        with self.torch.inference_mode():
            return self.encoder(self.torch.tensor(frames, dtype=self.torch.float32)).numpy().astype(np.uint8)

    def decode(self, received, variance, batch_size=16):
        if variance <= 0:
            raise ValueError("Use finite positive variance for soft decoding")
        # Sionna expects log(P(1)/P(0)), hence the negative sign for 0 -> +1.
        logits = (-2 * np.asarray(received) / variance).astype(np.float32)
        with self.torch.inference_mode():
            return np.concatenate([self.decoder(self.torch.from_numpy(batch)).numpy().astype(np.uint8)
                                   for batch in np.array_split(logits, max(1, math.ceil(len(logits) / batch_size)))])


def transmit(bits, snr_db, codec=None, seed=SEED):
    k = codec.parameters.k if codec else CodeParameters().k
    bits = np.asarray(bits, dtype=np.uint8)
    padding = (-len(bits)) % k
    frames = np.pad(bits, (0, padding)).reshape(-1, k)
    encoded = codec.encode(frames) if codec else frames
    variance = digital_variance(snr_db)
    received = channel(bpsk(encoded), variance, seed)
    raw = errors(encoded, hard_decision(received))
    decoded = codec.decode(received, variance) if codec else hard_decision(received)
    post = errors(frames, decoded)
    return decoded.reshape(-1)[:len(bits)], {
        "channel_ber": raw["ber"], "channel_bit_errors": raw["bit_errors"],
        "post_ber": post["ber"], "fer": post["fer"],
        "bit_errors": post["bit_errors"], "frame_errors": post["frame_errors"],
        "frames": post["frames"], "information_bits": int(len(bits)),
        "evaluated_bits": post["bits"], "padding_bits": padding,
        "channel_bits": int(encoded.size), "rate": frames.size / encoded.size,
        "overhead": encoded.size / len(bits)}
