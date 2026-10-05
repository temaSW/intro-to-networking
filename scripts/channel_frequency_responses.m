% Three illustrative channel amplitude-frequency responses (base MATLAB).
% Run from the repository root:
%   matlab -batch "run('scripts/channel_frequency_responses.m')"
%
% The frequency axis is an offset from the carrier. Each channel is a
% deterministic tapped-delay model: H(f) = sum_k a_k exp(-j*2*pi*f*tau_k).
% Tap amplitudes/phases are examples, not measurements or standard profiles.
% The satellite example assumes a line-of-sight Ku-band downlink.

channels = struct( ...
    'name', {'Wi-Fi 5 GHz', '5G FR2 FWA', 'Satellite (Ku, LOS)'}, ...
    'carrierGHz', {5.2, 28, 12}, ...
    'bandwidthMHz', {80, 400, 36}, ...
    'delayNs', {[0 35 90 160 260], [0 12], [0 18]}, ...
    'tapPowerDB', {[0 -3 -6 -9 -13], [0 -4], [0 -26]}, ...
    'tapPhaseRad', {[0 1.4 -0.9 2.2 -2.0], [0 0.7], [0 1.1]});

figure('Color', 'w', 'Position', [100 100 900 780]);
layout = tiledlayout(3, 1, 'TileSpacing', 'compact', 'Padding', 'compact');

for channelIndex = 1:numel(channels)
    channel = channels(channelIndex);
    offsetMHz = linspace(-channel.bandwidthMHz/2, ...
                          channel.bandwidthMHz/2, 2001);
    frequencyHz = offsetMHz * 1e6;
    delaySeconds = channel.delayNs * 1e-9;
    taps = 10.^(channel.tapPowerDB/20) .* exp(1i * channel.tapPhaseRad);
    taps = taps / sqrt(sum(abs(taps).^2));

    % Frequency response of the complex baseband equivalent channel.
    response = taps * exp(-1i * 2*pi * delaySeconds(:) * frequencyHz);
    amplitudeDB = 20 * log10(max(abs(response), eps));

    nexttile;
    plot(offsetMHz, amplitudeDB, 'LineWidth', 1.7);
    grid on;
    xlim([-channel.bandwidthMHz/2, channel.bandwidthMHz/2]);
    ylabel('|H(f)|, dB');
    title(sprintf('%s: f_c = %.1f GHz, B = %g MHz', ...
                  channel.name, channel.carrierGHz, channel.bandwidthMHz));
end

xlabel(layout, 'Frequency offset from carrier, MHz');
title(layout, 'Illustrative channel amplitude-frequency responses');

outputFile = fullfile(fileparts(mfilename('fullpath')), ...
                      'channel_frequency_responses.png');
exportgraphics(gcf, outputFile, 'Resolution', 180);
fprintf('Saved %s\n', outputFile);
