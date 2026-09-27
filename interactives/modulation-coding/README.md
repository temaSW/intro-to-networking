# Modulation + coding + channel

Reusable learning component: explore the joint trade-off between SNR, QAM order and code rate.

## Student controls

- SNR in dB;
- modulation order;
- code rate (for example 1/2, 2/3, 3/4, 5/6);
- number of blocks / a deterministic seed.

## Observable result

At minimum show information bits, transmitted coded bits, nominal efficiency `Q_m R_c`, and an explicitly model-dependent error indicator. A future version may use a simplified coded-block abstraction; it must label this as a model, not as 5G BLER data.

## Teaching use

Before changing `R_c = 5/6` to `1/2`, ask what must happen to useful rate and to error tolerance. The purpose is to see that reliability consumes physical resource.

## Current implementation

The working browser component is in `course/interactives/lecture-04-model.js` and `lecture-04-ui.js`. It uses short teaching block codes and nearest-codeword hard decisions; it is not a 5G LDPC/Polar or BLER simulation. The Python/marimo version can reuse the parameters and method of comparison below.

## Implementation boundary

Separate the channel/error model from the interface. Do not present a synthetic universal MCS-to-SNR mapping.
