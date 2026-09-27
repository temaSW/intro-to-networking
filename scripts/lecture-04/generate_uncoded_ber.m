% BER without channel coding: 5G NR QPSK/16QAM/64QAM symbol mapping over AWGN.
% Run from repository root: matlab -batch "run('scripts/lecture-04/generate_uncoded_ber.m')"
% Requires MATLAB R2024a and 5G Toolbox. SNR is Es/N0 for unit-power symbols.

rng(20260929, 'twister');
repositoryRoot = fileparts(fileparts(fileparts(mfilename('fullpath'))));
outputFile = fullfile(repositoryRoot,'course','data','lecture-04','uncoded-ber-awgn.csv');
schemes = {'QPSK','16QAM','64QAM'};
bitsPerSymbol = [2,4,6];
snrRanges = {-4:1:13, 0:1:20, 4:1:24};
bitsPerBatch = 60000;
minimumBatches = 2;
maximumBatches = 10;
targetBitErrors = 500;

file = fopen(outputFile,'w');
assert(file > 0,'Cannot open output CSV');
fprintf(file,'scheme,modulation,code_rate,snr_db,bit_errors,information_bits,ber,blocks\n');
fclose(file);

for scheme = 1:numel(schemes)
    modulation = schemes{scheme};
    q = bitsPerSymbol(scheme);
    assert(mod(bitsPerBatch,q) == 0);
    for snrDB = snrRanges{scheme}
        noiseVariance = 10^(-snrDB/10);
        bitErrors = 0;
        batches = 0;
        while batches < minimumBatches || (batches < maximumBatches && bitErrors < targetBitErrors)
            bits = randi([0 1],bitsPerBatch,1,'int8');
            symbols = nrSymbolModulate(bits,modulation);
            noise = sqrt(noiseVariance/2) * (randn(size(symbols)) + 1i*randn(size(symbols)));
            received = symbols + noise;
            decisions = nrSymbolDemodulate(received,modulation,'DecisionType','Hard');
            bitErrors = bitErrors + nnz(decisions ~= bits);
            batches = batches + 1;
        end
        informationBits = batches * bitsPerBatch;
        file = fopen(outputFile,'a');
        fprintf(file,'%d,%s,1,%.1f,%d,%d,%.10g,%d\n',scheme+5,modulation,snrDB,bitErrors,informationBits,bitErrors/informationBits,batches);
        fclose(file);
        fprintf('%s uncoded SNR=%+.1f dB: %d/%d BER=%g\n',modulation,snrDB,bitErrors,informationBits,bitErrors/informationBits);
    end
end
