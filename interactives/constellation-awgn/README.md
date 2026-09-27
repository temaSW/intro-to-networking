# Constellation + AWGN

Reusable learning component: compare QPSK, 16-QAM, 64-QAM and optionally 256-QAM at a fixed SNR.

## Student controls

- modulation order;
- SNR in dB;
- number of transmitted symbols;
- optional fixed random seed / «new experiment».

## Observable result

Show ideal constellation points, received points, nearest-point decisions, symbol-error rate and (when bit mapping is implemented) bit-error rate. The model must make it possible to keep SNR fixed and change only the modulation order.

## Teaching use

Ask for a prediction with QPSK, then keep SNR unchanged and switch to 64-QAM. The component is not a BER calculator lesson; it makes the shrinking decision margin visible.

## Current implementation

The working browser component is in `course/interactives/lecture-04-model.js` and `lecture-04-ui.js`. It runs directly on the static Quarto site without a server. A marimo/Pyodide port can reuse the controls and scenario below.

## Implementation boundary

Keep the channel/model in Python separately from the marimo UI. Use browser execution via Pyodide when the course integration is selected. Do not introduce a shared interactive framework here.
