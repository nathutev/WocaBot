(function () {
    let config = {
        enabled: false,
        minDelay: 1000,
        maxDelay: 2000,
    };

    let wordsData = null;

    // load config from storage if exists
    chrome.storage.local.get(['wb_enabled', 'wb_minDelay', 'wb_maxDelay'], (result) => {
        if (result.wb_enabled !== undefined) config.enabled = result.wb_enabled;
        if (result.wb_minDelay !== undefined) config.minDelay = result.wb_minDelay;
        if (result.wb_maxDelay !== undefined) config.maxDelay = result.wb_maxDelay;
        createUI();
        injectScript();
    });

    // data from script
    window.addEventListener("message", (event) => {
        if (event.source !== window) return;
        if (event.data.type && event.data.type === "WOCABEE_DATA") {
            wordsData = event.data.words;
            console.log("WocaBot by nath.u: Slovíčka načtena.");
            updateStatus(config.enabled ? 'Aktivní' : 'Neaktivní');
        }
    });

    function injectScript() {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('inject.js');
        (document.head || document.documentElement).appendChild(script);
    }

    function createUI() {
        if (document.getElementById('wb-auto-panel')) return;
        const ui = document.createElement('div');
        ui.id = 'wb-auto-panel';
        ui.innerHTML = `
            <div class="wb-auto-header">WocaBot</div>
            <div class="wb-auto-body">
                <label><input type="checkbox" id="wb-auto-toggle" ${config.enabled ? 'checked' : ''}> Aktivovat</label>
                <!--<div class="wb-auto-speed">
                    <span>Delay (ms):</span>
                    <input type="number" id="wb-auto-min" value="${config.minDelay}" step="100" style="width: 60px;"> - 
                    <input type="number" id="wb-auto-max" value="${config.maxDelay}" step="100" style="width: 60px;">
                </div>-->
                <div>
                <div id="wb-auto-status">Načítání...</div>
                <div id="wb-auto-debug" style="font-size:10px; color:#aaa; margin-top:5px; border-top:1px solid #444; padding-top:5px;"></div>
            </div>
        `;
        document.body.appendChild(ui);

        document.getElementById('wb-auto-toggle').addEventListener('change', (e) => {
            config.enabled = e.target.checked;
            chrome.storage.local.set({ wb_enabled: config.enabled });
            updateStatus(config.enabled ? 'Aktivní' : 'Neaktivní');
            if (config.enabled) mainLoop();
        });

        const updateConfig = () => {
            config.minDelay = parseInt(document.getElementById('wb-auto-min').value);
            config.maxDelay = parseInt(document.getElementById('wb-auto-max').value);
            chrome.storage.local.set({ wb_minDelay: config.minDelay, wb_maxDelay: config.maxDelay });
        };

        document.getElementById('wb-auto-min').addEventListener('change', updateConfig);
        document.getElementById('wb-auto-max').addEventListener('change', updateConfig);

        if (config.enabled) mainLoop();
    }

    function updateStatus(text) {
        const el = document.getElementById('wb-auto-status');
        if (el) el.innerText = text;
    }

    function updateDebug(text) {
        const el = document.getElementById('wb-auto-debug');
        if (el) el.innerText = text;
    }

    function getRandomDelay() {
        return Math.floor(Math.random() * (config.maxDelay - config.minDelay + 1)) + config.minDelay;
    }

    async function mainLoop() {
        if (!config.enabled) return;

        try {
            await handleExercise();
        } catch (e) {
            console.error('WocaBot error:', e);
            updateDebug('ERR: ' + e.message);
        }

        setTimeout(mainLoop, 1000);
    }

    async function handleExercise() {
        const exercises = [
            { id: 'choosePicture', type: 'choosePicture' },
            { id: 'translateWord', type: 'translate' },
            { id: 'describePicture', type: 'describePicture' },
            { id: 'completeWord', type: 'complete' },
            { id: 'addMissingWord', type: 'missing' },
            { id: 'chooseWord', type: 'choice' },
            { id: 'pexeso', type: 'pexeso' },
            { id: 'findPair', type: 'findPair' },
            { id: 'oneOutOfMany', type: 'oneOutOfMany' },
            { id: 'transcribe', type: 'transcribe' },
            { id: 'translateFallingWord', type: 'translateFalling' }
        ];

        let active = exercises.find(ex => {
            const el = document.getElementById(ex.id);
            return el && el.style.display !== 'none';
        });

        if (!active) {
            const intro = document.getElementById('intro');
            if (intro && intro.style.display !== 'none') {
                const nextBtn = document.getElementById('introNext');
                if (nextBtn && nextBtn.style.display !== 'none') {
                    updateStatus('Proklikávám...');
                    await sleep(getRandomDelay());
                    nextBtn.click();
                    return;
                }
                const runBtn = document.getElementById('introRun');
                if (runBtn && runBtn.style.display !== 'none') {
                    updateStatus('Start balíčku...');
                    await sleep(getRandomDelay());
                    runBtn.click();
                    return;
                }
            }

            const successBtn = document.querySelector('.btn-success.btn-block:not([disabled])');
            if (successBtn && successBtn.innerText.toLowerCase().includes('dále') && successBtn.offsetParent !== null) {
                updateStatus('Pokračuji...');
                await sleep(getRandomDelay());
                successBtn.click();
                return;
            }

            updateStatus('Čekám...');
            updateDebug('');
            return;
        }

        updateStatus('Typ cvičení: ' + active.type);

        const answer = getAnswer(active.type);
        if (!answer && active.type !== 'pexeso' && active.type !== 'findPair' && active.type !== 'choosePicture') {
            updateDebug('Odpověď nenalezena');
            return;
        }

        updateDebug('Odpověď: ' + (answer || 'N/A'));
        await sleep(getRandomDelay());

        switch (active.type) {
            case 'translate':
                fillInput('translateWordAnswer', answer);
                clickButton('translateWordSubmitBtn');
                break;
            case 'describePicture':
                fillInput('describePictureAnswer', answer);
                clickButton('describePictureSubmitBtn');
                break;
            case 'transcribe':
                fillInput('transcribeAnswerWord', answer);
                clickButton('transcribeSubmitBtn');
                break;
            case 'translateFalling':
                fillInput('translateFallingWordAnswer', answer);
                clickButton('translateFallingWordSubmitBtn');
                break;
            case 'complete':
                await handleCompleteWord(answer);
                break;
            case 'choice':
                handleChoice(answer);
                break;
            case 'pexeso':
                await handlePexeso();
                break;
            case 'oneOutOfMany':
                handleOneOutOfMany(answer);
                break;
            case 'findPair':
                await handleFindPair();
                break;
            case 'missing':
                fillInput('missingWordAnswer', answer);
                clickButton('addMissingWordSubmitBtn');
                break;
            case 'choosePicture':
                await handleChoosePicture();
                break;
        }
    }

    async function handleChoosePicture() {
        const wordIdEl = document.getElementById('word_id');
        const targetWordId = wordIdEl ? wordIdEl.value : null;
        if (!targetWordId) return;

        const images = Array.from(document.querySelectorAll('#choosePicture .picture'));
        const correctImg = images.find(img => img.getAttribute('word_id') === targetWordId);

        if (correctImg) {
            updateDebug('Klikám na obrázek');

            realClick(correctImg);
            await sleep(200);
            realClick(correctImg);
        } else {
            updateDebug('Obrázek nenalezen');
        }
    }

    function getAnswer(type) {
        const aWordEl = document.getElementById('a_word');
        const aWord = aWordEl ? aWordEl.value : null;

        const wordIdEl = document.getElementById('word_id');
        const wordId = wordIdEl ? parseInt(wordIdEl.value) : null;

        let wordData = null;
        if (wordId && wordsData) {
            wordData = wordsData.find(w => w.word_id === wordId);
        }
/*
        if (wordData) {
            console.log("wordData:", wordData);
        }
*/
        // completeWord
        if (type === 'complete') {
            const patternEl = document.getElementById('completeWordAnswer');
            const pattern = patternEl ? patternEl.innerText.trim() : null;
            if (pattern && wordsData) {
                // "en_l_ch" -> "endlich"
                const regex = new RegExp('^' + pattern.replace(/_/g, '.') + '$');
                const match = wordsData.find(w => regex.test(w.word) || regex.test(w.translation));
                if (match) {
                    return regex.test(match.word) ? match.word : match.translation;
                }
            }
        }

        if (type === 'choice' || type === 'oneOutOfMany') {
            const qId = type === 'choice' ? 'ch_word' : 'oneOutOfManyQuestionWord';
            const questionEl = document.getElementById(qId);
            if (questionEl && wordsData) {
                const question = questionEl.innerText.trim();
                let match = wordData;
                if (!match) {
                    match = wordsData.find(w =>
                        w.word.toLowerCase() === question.toLowerCase() ||
                        w.translation.toLowerCase() === question.toLowerCase()
                    );
                }
                if (match) {
                    return (match.word.toLowerCase() === question.toLowerCase()) ? match.translation : match.word;
                }
            }
        }

        if (aWord) {
            if (wordData && aWord === wordData.word && type !== 'translate') {
                return wordData.translation;
            }
            return aWord;
        }

        if (wordData) {
            const typeEl = document.getElementById('a_type');
            if (typeEl && typeEl.value === 'word') return wordData.word;
            return wordData.translation;
        }

        return null;
    }

    function fillInput(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        }
    }

    function clickButton(id) {
        const el = document.getElementById(id);
        if (el && !el.disabled && el.offsetParent !== null) {
            el.click();
        }
    }

    function handleChoice(answer) {
        const options = Array.from(document.querySelectorAll('#chooseWords .btn'));
        const opt = options.find(o => o.innerText.trim().toLowerCase() === answer.toLowerCase());
        if (opt) opt.click();
    }

    function handleOneOutOfMany(answer) {
        const options = Array.from(document.querySelectorAll('#oneOutOfManyWords .btn'));
        const opt = options.find(o => o.innerText.trim().toLowerCase() === answer.toLowerCase());
        if (opt) opt.click();
    }

    async function handleCompleteWord(answer) {
        if (!answer) return;
        let chars = Array.from(document.querySelectorAll('#characters .char, #characters .keyboardChar, #characters .btn'))
            .filter(c => c.offsetParent !== null && c.style.visibility !== 'hidden' && c.getAttribute('is_hidden') !== '1');

        if (chars.length === 0) return;

        const pattern = document.getElementById('completeWordAnswer').innerText.trim();

        for (let i = 0; i < pattern.length; i++) {
            if (pattern[i] === '_') {
                const targetChar = answer[i];
                // refresh available chars
                let availableChars = Array.from(document.querySelectorAll('#characters .char, #characters .keyboardChar, #characters .btn'))
                    .filter(c => c.offsetParent !== null && c.style.visibility !== 'hidden' && c.getAttribute('is_hidden') !== '1');

                const btn = availableChars.find(c => c.innerText.trim() === targetChar);
                if (btn) {
                    realClick(btn);
                    await sleep(300);
                }
            }
        }

        await sleep(500);
        clickButton('completeWordSubmitBtn');
    }

    async function handleFindPair() {
        // visible active buttons
        const qWords = Array.from(document.querySelectorAll('#q_words .btn, .fp_q'))
            .filter(b => b.offsetParent !== null && !b.disabled && !b.classList.contains('btn-success-active'));
        const aWords = Array.from(document.querySelectorAll('#a_words .btn, .fp_a'))
            .filter(b => b.offsetParent !== null && !b.disabled && !b.classList.contains('btn-success-active'));

        if (qWords.length === 0 || aWords.length === 0) return;

        for (let i = 0; i < 3; i++) {
            const qBtn = qWords[i];
            const wId = qBtn.getAttribute('w_id');
            const aBtn = aWords.find(btn => btn.getAttribute('w_id') === wId);

            if (qBtn && aBtn) {
                updateDebug('Spojuji slova');
                realClick(qBtn);
                await sleep(400);
                realClick(aBtn);
            }
        }
    }

    function realClick(el) {
        if (!el) return;
        const events = ['mousedown', 'mouseup', 'click'];
        events.forEach(type => {
            el.dispatchEvent(new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                view: window
            }));
        });
    }

    async function handlePexeso() {
        const cards = Array.from(document.querySelectorAll('.pexesoCardWrapper'));
        if (cards.length === 0) return;

        let groups = {};
        cards.forEach(card => {
            const wId = card.getAttribute('w_id');
            // leave only available
            if (card.style.visibility !== 'hidden' && card.offsetParent !== null && card.getAttribute('marked') !== '1') {
                if (!groups[wId]) groups[wId] = [];
                groups[wId].push(card);
            }
        });

        for (let wId in groups) {
            if (groups[wId].length === 2) {
                const pair = groups[wId];
                const card1 = pair[0].querySelector('.pexesoFront');
                const card2 = pair[1].querySelector('.pexesoFront');

                if (!card1 || !card2) continue;

                updateDebug('Otevírám pár');
                realClick(card1);
                await sleep(400);
                realClick(card1);
                await sleep(400);
                realClick(card2);
                await sleep(400);
                realClick(card2);

                await sleep(600);
                break;
            }
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

})();
