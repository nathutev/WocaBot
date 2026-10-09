(function () {
    let config = {
        enabled: false,
        shrink: false,
        speed: 'medium' // 'slow', 'medium', 'fast'
    };

    let wordsData = null;
    let isRunning = false;

    function init() {
        if (!document.body) {
            setTimeout(init, 100);
            return;
        }

        const observer = new MutationObserver(() => {
            if (config.enabled && !isRunning) mainLoop();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        chrome.storage.local.get(['wb_enabled', 'wb_shrink', 'wb_speed'], (result) => {
            if (result.wb_enabled !== undefined) config.enabled = result.wb_enabled;
            if (result.wb_shrink !== undefined) config.shrink = result.wb_shrink;
            if (result.wb_speed !== undefined) config.speed = result.wb_speed;
            createUI();
            injectScript();
        });
    }

    const forceOpacity = document.createElement('style');
    forceOpacity.innerHTML = `
        * { 
            opacity: 1 !important; 
            visibility: visible !important; 
        }
    `;
    (document.head || document.documentElement).appendChild(forceOpacity);

    init();

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
        if (!document.body || document.getElementById('wb-auto-panel')) return;
        const ui = document.createElement('div');
        ui.id = 'wb-auto-panel';
        if (config.shrink) ui.classList.add('wb-shrunk');
        ui.innerHTML = `
            <div class="wb-auto-header">WocaBot</div>
            <div class="wb-auto-body">
                <label><input type="checkbox" id="wb-auto-toggle" ${config.enabled ? 'checked' : ''}> <span class="wb-label-text">Aktivovat</span></label>
                <label><input type="checkbox" id="wb-auto-shrink" ${config.shrink ? 'checked' : ''}> <span class="wb-label-text">Zmenšit</span></label>
                <div style="margin-top: 5px;">
                    <span class="wb-label-text">Rychlost:</span>
                    <select id="wb-auto-speed" style="background:#333; color:#fff; border:1px solid #555; border-radius:3px; padding:2px;">
                        <option value="slow" ${config.speed === 'slow' ? 'selected' : ''}>Pomalá</option>
                        <option value="medium" ${config.speed === 'medium' ? 'selected' : ''}>Střední</option>
                        <option value="fast" ${config.speed === 'fast' ? 'selected' : ''}>Rychlá</option>
                    </select>
                </div>
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

        document.getElementById('wb-auto-shrink').addEventListener('change', (e) => {
            config.shrink = e.target.checked;
            chrome.storage.local.set({ wb_shrink: config.shrink });
            if (config.shrink) {
                ui.classList.add('wb-shrunk');
            } else {
                ui.classList.remove('wb-shrunk');
            }
        });

        document.getElementById('wb-auto-speed').addEventListener('change', (e) => {
            config.speed = e.target.value;
            chrome.storage.local.set({ wb_speed: config.speed });
        });

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
        let min = 600, max = 1200;
        if (config.speed === 'slow') { min = 1500; max = 2500; }
        else if (config.speed === 'fast') { min = 100; max = 300; }
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    async function mainLoop() {
        if (!config.enabled || isRunning) return;
        isRunning = true;
        
        try {
            let startPackageBtn = document.querySelector('.actionBtn.btn.btn-success.btn-block');
            if (startPackageBtn) {
                realClick(startPackageBtn.parentElement);
            }

            let progressValue = document.querySelector('#progressValue');
            if (progressValue && progressValue.textContent === '100%') {
                let leaveBtn = document.querySelector('.btn.btn-lg.btn-warning.btn-block') || document.querySelector('button.btn-warning');
                if (leaveBtn) {
                    realClick(leaveBtn);
                    isRunning = false;
                    setTimeout(mainLoop, 1000);
                    return;
                }
            }

            await handleExercise();
        } catch (e) {
            console.error('WocaBot error:', e);
            updateDebug('ERR: ' + e.message);
        } finally {
            isRunning = false;
        }
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
            { id: 'translateFallingWord', type: 'translateFalling' },
            { id: 'listenAndChoose', type: 'listenAndChoose' },
            { id: 'chooseSpelling', type: 'chooseSpelling' },
            { id: 'matchPair', type: 'matchPair' },
            { id: 'arrangeWords', type: 'arrangeWords' }
        ];

        let active = exercises.find(ex => {
            const el = document.getElementById(ex.id);
            return el && el.style.display !== 'none' && el.offsetParent !== null;
        });

        if (!active) {
            const intro = document.getElementById('intro');
            if (intro && intro.style.display !== 'none' && intro.offsetParent !== null) {
                const nextBtn = document.getElementById('introNext') || document.getElementById('introRun');
                if (nextBtn && nextBtn.style.display !== 'none' && nextBtn.offsetParent !== null) {
                    updateStatus('Intro: Pokračuji...');
                    await sleep(getRandomDelay());
                    realClick(nextBtn);
                    return;
                }

                const introButtons = Array.from(intro.querySelectorAll('.btn:not([disabled]), button:not([disabled])'))
                    .filter(b => b.offsetParent !== null);
                if (introButtons.length > 0) {
                    const bestBtn = introButtons.find(b => b.innerText.toLowerCase().includes('dále') || b.innerText.toLowerCase().includes('spustit')) || introButtons[0];
                    updateStatus('Intro: Klikám (auto)...');
                    await sleep(getRandomDelay());
                    realClick(bestBtn);
                    return;
                }
            }

            const nextKeywords = ['dále', 'dale', 'další', 'dalsi', 'next', 'continue'];
            const successBtn = document.querySelector('.btn-success:not([disabled]), .btn-primary:not([disabled]), .btn-block:not([disabled])');
            if (successBtn && successBtn.offsetParent !== null) {
                const text = successBtn.innerText.toLowerCase();
                if (nextKeywords.some(kw => text.includes(kw))) {
                    updateStatus('Pokračuji...');
                    await sleep(getRandomDelay());
                    realClick(successBtn);
                    return;
                }
            }

            const nextBtn = document.getElementById('nextBtn');
            if (nextBtn && nextBtn.offsetParent !== null) {
                updateStatus('Pokračuji (nextBtn)...');
                await sleep(getRandomDelay());
                realClick(nextBtn);
                return;
            }

            updateStatus('Čekám...');
            updateDebug('');
            return;
        }

        updateStatus('Typ cvičení: ' + active.type);

        const answer = getAnswer(active.type);
        if (!answer && !['pexeso', 'findPair', 'matchPair', 'choosePicture'].includes(active.type)) {
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
                handleChoice(answer, '#chooseWords .btn');
                break;
            case 'listenAndChoose':
                handleChoice(answer, '#listenAndChooseWords .btn');
                break;
            case 'chooseSpelling':
                handleChoice(answer, '#chooseSpellingWords .btn');
                break;
            case 'pexeso':
                await handlePexeso();
                break;
            case 'oneOutOfMany':
                handleChoice(answer, '#oneOutOfManyWords .btn');
                break;
            case 'findPair':
                await handleFindPair();
                break;
            case 'matchPair':
                await handleMatchPair();
                break;
            case 'missing':
                fillInput('missingWordAnswer', answer);
                clickButton('addMissingWordSubmitBtn');
                break;
            case 'choosePicture':
                await handleChoosePicture();
                break;
            case 'arrangeWords':
                await handleArrangeWords(answer);
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

        if (type === 'complete') {
            const patternEl = document.getElementById('completeWordAnswer');
            const pattern = patternEl ? patternEl.innerText.trim() : null;
            if (pattern && wordsData) {
                const regexStr = '^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '.') + '$';
                const regex = new RegExp(regexStr);
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

        if (type === 'arrangeWords') {
            const questionEl = document.getElementById('def-lang-sentence');
            if (questionEl && wordsData) {
                const question = questionEl.innerText.trim();
                let match = wordsData.find(w => w.word === question || w.translation === question);
                if (match) {
                    return match.word === question ? match.translation : match.word;
                }
            }
        }
        
        if (type === 'chooseSpelling' && wordData) {
            return wordData.word;
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
            realClick(el);
        }
    }

    function handleChoice(answer, selector) {
        const options = Array.from(document.querySelectorAll(selector));
        const opt = options.find(o => o.innerText.trim().toLowerCase() === answer.toLowerCase());
        if (opt) realClick(opt);
    }

    async function handleCompleteWord(answer) {
        if (!answer) return;
        const patternEl = document.getElementById('completeWordAnswer');
        if (!patternEl) return;
        const pattern = patternEl.innerText.trim();

        for (let i = 0; i < pattern.length; i++) {
            if (pattern[i] === '_') {
                const targetChar = answer[i];
                let availableChars = Array.from(document.querySelectorAll('#characters .char, #characters .keyboardChar, #characters .btn'))
                    .filter(c => c.offsetParent !== null && c.style.visibility !== 'hidden' && c.getAttribute('is_hidden') !== '1');

                const btn = availableChars.find(c => c.innerText.trim() === targetChar);
                if (btn) {
                    realClick(btn);
                    await sleep(150);
                }
            }
        }

        await sleep(300);
        clickButton('completeWordSubmitBtn');
    }

    async function handleFindPair() {
        const qWords = Array.from(document.querySelectorAll('#q_words .btn, .fp_q'))
            .filter(b => b.offsetParent !== null && !b.disabled && !b.classList.contains('btn-success-active'));
        const aWords = Array.from(document.querySelectorAll('#a_words .btn, .fp_a'))
            .filter(b => b.offsetParent !== null && !b.disabled && !b.classList.contains('btn-success-active'));

        if (qWords.length === 0 || aWords.length === 0) return;

        for (let i = 0; i < 3; i++) {
            const qBtn = qWords[i];
            if (!qBtn) continue;
            const wId = qBtn.getAttribute('w_id');
            const aBtn = aWords.find(btn => btn.getAttribute('w_id') === wId);

            if (aBtn) {
                updateDebug('Spojuji slova');
                realClick(qBtn);
                await sleep(300);
                realClick(aBtn);
                await sleep(100);
            }
        }
    }

    async function handleMatchPair() {
        const btns = Array.from(document.querySelectorAll('#matchPairWords .btn'))
            .filter(b => b.offsetParent !== null && !b.disabled && !b.classList.contains('btn-success-active'));

        let groups = {};
        btns.forEach(b => {
            const wId = b.getAttribute('w_id');
            if (wId) {
                if (!groups[wId]) groups[wId] = [];
                groups[wId].push(b);
            }
        });

        for (let wId in groups) {
            if (groups[wId].length >= 2) {
                updateDebug('Spojuji slova');
                realClick(groups[wId][0]);
                await sleep(300);
                realClick(groups[wId][1]);
                await sleep(100);
            }
        }
    }

    async function handleArrangeWords(answer) {
        if (!answer) return;
        const words = answer.split(' ');
        const container = document.getElementById('sortableWords');
        if (!container) return;

        const items = Array.from(container.children);
        
        words.forEach(word => {
            const item = items.find(el => el.innerText.trim() === word);
            if (item) {
                container.appendChild(item);
            }
        });
        
        await sleep(400);
        clickButton('arrangeWordsSubmitBtn');
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
                await sleep(300);
                realClick(card1);
                await sleep(300);
                realClick(card2);
                await sleep(300);
                realClick(card2);

                await sleep(800);
            }
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
})();