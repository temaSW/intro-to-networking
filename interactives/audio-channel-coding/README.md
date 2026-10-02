# Аудио через шумный канал

Независимая модель в `model.py`; браузерный компонент в
`course/interactives/audio-channel-coding/{model.js,ui.js,ui.css}`. Эти пути
соответствуют принятому в проекте разделению моделей разработчика и ресурсов
статического сайта. Общий фреймворк интерактивов не требуется.

Компонент можно вставить в любую страницу:

```html
<link rel="stylesheet" href="PATH/ui.css">
<div class="audio-channel-demo" data-audio-channel-demo
     data-manifest="ASSETS/manifest.json"></div>
<script type="module" src="PATH/ui.js"></script>
```

`data-manifest` разрешается относительно страницы; пути файлов внутри manifest —
относительно manifest. Несколько экземпляров имеют независимые группы переключателей
и аудиоконтексты. `root.audioChannelDemo.destroy()` освобождает аудиоконтекст и
наблюдатели при удалении компонента из динамической страницы.

Python: генерация — `scripts/generate_audio_channel_demo.py`, измерения —
`scripts/benchmark_audio_channel.py`. Настоящий Sionna LDPC декодирует каждый блок
до сохранения аудио. Браузер не фильтрует и не «улучшает» сигнал.

Формат пакетов: little-endian mono PCM16, один фрагмент на каждую точку SNR
последовательно, без заголовка. Исходный звук — отдельный однокадровый пакет.
Manifest задаёт длину, частоту, общий gain, параметры кода, определения SNR,
метрики и SHA-256. Новый алгоритм можно подготовить как ещё один пакет и режим,
сохраняя тот же контракт.

Подробности, команды и измеренные кривые: `docs/audio-channel-coding/README.md`.
