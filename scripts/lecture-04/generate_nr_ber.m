% Reproduce measured information-bit BER for a simplified 5G NR DL-SCH chain.
% Run from repository root: matlab -batch "run('scripts/lecture-04/generate_nr_ber.m')"
% Requires MATLAB R2024a, 5G Toolbox and Communications Toolbox.
% This is not a full PDSCH/link-level simulation or an MCS-to-SNR mapping.

rng(20260928, 'twister');
repositoryRoot = fileparts(fileparts(fileparts(mfilename('fullpath'))));
outputFile = fullfile(repositoryRoot,'course','data','lecture-04','nr-ber-awgn.csv');
transportBlockSize = 1024;
redundancyVersion = 0;
layers = 1;
maximumIterations = 12;
minimumBlocks = 30;
maximumBlocks = 300;
targetBitErrors = 500;

schemes = {'QPSK', 'QPSK', '16QAM', '16QAM', '64QAM'};
rates = [1/2, 3/4, 1/2, 3/4, 3/4];
bitsPerSymbol = [2, 2, 4, 4, 6];
snrRanges = {-4:1:3, -2:1:6, 2:1:9, 4:1:12, 9:1:19};

file = fopen(outputFile, 'w');
assert(file > 0, 'Cannot open output CSV');
fprintf(file, 'scheme,modulation,code_rate,snr_db,bit_errors,information_bits,ber,blocks\n');
fclose(file);

for scheme = 1:numel(schemes)
    modulation = schemes{scheme};
    codeRate = rates(scheme);
    q = bitsPerSymbol(scheme);
    info = nrDLSCHInfo(transportBlockSize, codeRate);
    outputLength = q * ceil((transportBlockSize / codeRate) / q);
    for snrDB = snrRanges{scheme}
        bitErrors = 0;
        blocks = 0;
        while blocks < minimumBlocks || (blocks < maximumBlocks && bitErrors < targetBitErrors)
            source = randi([0 1], transportBlockSize, 1, 'int8');
            blockWithCRC = nrCRCEncode(source, info.CRC);
            codeBlocks = nrCodeBlockSegmentLDPC(blockWithCRC, info.BGN);
            encoded = nrLDPCEncode(codeBlocks, info.BGN);
            transmittedBits = nrRateMatchLDPC(encoded, outputLength, redundancyVersion, modulation, layers);
            symbols = nrSymbolModulate(transmittedBits, modulation);
            [receivedSymbols, noiseVariance] = awgn(symbols, snrDB, 'measured');
            softBits = nrSymbolDemodulate(receivedSymbols, modulation, noiseVariance);
            recovered = nrRateRecoverLDPC(softBits, transportBlockSize, codeRate, redundancyVersion, modulation, layers);
            decoded = nrLDPCDecode(recovered, info.BGN, maximumIterations);
            [decodedBlock, ~] = nrCodeBlockDesegmentLDPC(decoded, info.BGN, transportBlockSize + info.L);
            [result, ~] = nrCRCDecode(decodedBlock, info.CRC);
            bitErrors = bitErrors + nnz(result ~= source);
            blocks = blocks + 1;
        end
        informationBits = blocks * transportBlockSize;
        file = fopen(outputFile, 'a');
        fprintf(file, '%d,%s,%.6f,%.1f,%d,%d,%.10g,%d\n', scheme, modulation, codeRate, snrDB, bitErrors, informationBits, bitErrors/informationBits, blocks);
        fclose(file);
        fprintf('%s R=%.2f SNR=%+.1f dB: %d/%d, BER=%g\n', modulation, codeRate, snrDB, bitErrors, informationBits, bitErrors/informationBits);
    end
end
