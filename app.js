(function () {
    let config = {
        enabled: false,
        shrink: false,
        speed: 'medium', // 'slow', 'medium', 'fast'
        makeError: false,
        errorRate: 15
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

        // Fallback safety interval in case style changes don't trigger the observer
        setInterval(() => {
            if (config.enabled && !isRunning) mainLoop();
        }, 1000);

        chrome.storage.local.get(['wb_enabled', 'wb_shrink', 'wb_speed', 'wb_make_error', 'wb_error_rate'], (result) => {
            if (result.wb_enabled !== undefined) config.enabled = result.wb_enabled;
            if (result.wb_shrink !== undefined) config.shrink = result.wb_shrink;
            if (result.wb_speed !== undefined) config.speed = result.wb_speed;
            if (result.wb_make_error !== undefined) config.makeError = result.wb_make_error;
            if (result.wb_error_rate !== undefined) config.errorRate = result.wb_error_rate;
            createUI();
            injectScript();
        });
    }

    const fixStyles = document.createElement('style');
    fixStyles.innerHTML = `
        .modal-backdrop { 
            display: none !important; 
            opacity: 0 !important; 
            pointer-events: none !important; 
        }
    `;
    (document.head || document.documentElement).appendChild(fixStyles);

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
                <label><input type="checkbox" id="wb-auto-error" ${config.makeError ? 'checked' : ''}> <span class="wb-label-text">Dělat chyby</span></label>
                <div class="wb-auto-error-rate" id="wb-error-wrapper">
                    <span class="wb-label-text">Šance na chybu:</span>
                    <input type="number" id="wb-auto-error-rate" min="1" max="100" value="${config.errorRate}" style="width:42px; text-align:center;">
                    <span class="wb-label-text">%</span>
                </div>
                <div class="wb-auto-speed" id="wb-speed-wrapper">
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

        document.getElementById('wb-auto-error').addEventListener('change', (e) => {
            config.makeError = e.target.checked;
            chrome.storage.local.set({ wb_make_error: config.makeError });
        });

        const errorRateInput = document.getElementById('wb-auto-error-rate');
        if (errorRateInput) {
            errorRateInput.addEventListener('change', (e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val) || val < 1) val = 1;
                if (val > 100) val = 100;
                e.target.value = val;
                config.errorRate = val;
                chrome.storage.local.set({ wb_error_rate: config.errorRate });
            });
            errorRateInput.addEventListener('input', (e) => {
                let val = parseInt(e.target.value);
                if (!isNaN(val) && val >= 1 && val <= 100) {
                    config.errorRate = val;
                    chrome.storage.local.set({ wb_error_rate: config.errorRate });
                }
            });
        }

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

    function isSavingActive() {
        const modal = document.getElementById('modalSavingPackage');
        if (modal) {
            if (modal.classList.contains('show') || modal.style.display === 'block' || (modal.offsetParent !== null && window.getComputedStyle(modal).display !== 'none')) {
                return true;
            }
        }
        const spinIcon = document.querySelector('#savingModalSecondaryIcon.fa-spin');
        if (spinIcon && spinIcon.offsetParent !== null) {
            return true;
        }
        const savingIcons = Array.from(document.querySelectorAll('.savingIcon, .fa-bounce'));
        if (savingIcons.some(i => i.offsetParent !== null && window.getComputedStyle(i).display !== 'none')) {
            return true;
        }
        return false;
    }

    function isElementVisible(el) {
        return !!(el && el.offsetParent !== null && window.getComputedStyle(el).display !== 'none' && window.getComputedStyle(el).visibility !== 'hidden');
    }

    function findUnfinishedPackage() {
        const table = document.getElementById('packagesTable');
        if (!table) {
            const btn = document.querySelector('.actionBtn.btn.btn-success.btn-block, .actionBtn.btn.btn-success');
            if (btn && isElementVisible(btn)) {
                const a = btn.closest('a');
                return { el: btn, link: a ? a.href : null };
            }
            return null;
        }

        // Inside #packagesTable, look for rows that are NOT done
        const rows = Array.from(table.querySelectorAll('tr.pTableRow'));
        for (let row of rows) {
            const status = row.getAttribute('data-status');
            if (status === 'done') continue; // Skip completed packages!

            const btn = row.querySelector('.actionBtn.btn-success, .btn.btn-success');
            if (btn && isElementVisible(btn)) {
                const a = btn.closest('a');
                return { el: btn, link: a ? a.href : null };
            }
        }
        return null;
    }

    async function mainLoop() {
        if (!config.enabled || isRunning) return;
        isRunning = true;
        
        try {
            // Check if we are on the class page and need to start an unfinished package
            const unfinished = findUnfinishedPackage();
            if (unfinished) {
                updateStatus('Spouštím balíček...');
                await sleep(getRandomDelay());
                if (unfinished.link) {
                    window.location.href = unfinished.link;
                    return;
                } else {
                    realClick(unfinished.el.parentElement || unfinished.el);
                    return;
                }
            } else if (document.getElementById('packagesTable')) {
                updateStatus('Všechny balíčky jsou hotové!');
                return;
            }

            // 1. If WocaBee is currently saving results, WAIT! Never navigate away during saving.
            if (isSavingActive()) {
                updateStatus('Ukládám výsledky do WocaBee...');
                return;
            }

            // 2. Check for problem words review screen (words with mistakes after homework)
            const problemWordsNext = document.getElementById('problem-words-next');
            if (isElementVisible(problemWordsNext)) {
                if (!problemWordsNext.disabled) {
                    updateStatus('Procházím problémová slova...');
                    await sleep(getRandomDelay());
                    realClick(problemWordsNext);
                } else {
                    updateStatus('Čekám na problémové slovo...');
                }
                return;
            }

            // 3. If quit screen is shown
            const leaveHomeworkBtn = document.getElementById('leaveHomeworkBtn');
            if (isElementVisible(leaveHomeworkBtn) && !isElementVisible(document.getElementById('doNotLeaveHomeworkBtn'))) {
                updateStatus('Ukládám a odcházím...');
                await sleep(getRandomDelay());
                realClick(leaveHomeworkBtn);
                return;
            }

            // 4. Check for completed package states
            let progressValue = document.querySelector('#progressValue');
            let is100 = progressValue && progressValue.textContent.trim() === '100%';
            let diffDaysInfo = document.getElementById('diffDaysExtraWocaPointsInfo');
            let isDiffDays = isElementVisible(diffDaysInfo);
            let msgCompleted = document.getElementById('msgCompleted');
            let isMsgCompleted = isElementVisible(msgCompleted);

            // Once 100% or completion message is reached, wait for the final button to appear and click it!
            if (is100 || isMsgCompleted || isDiffDays) {
                if (isSavingActive()) {
                    updateStatus('Ukládám výsledky do WocaBee...');
                    return;
                }

                // Look for the final exit button that WocaBee displays upon completion
                const exitButtons = [
                    document.getElementById('backBtn'),
                    document.getElementById('leaveBtn'),
                    document.getElementById('leaveBtnWrapper'),
                    document.getElementById('leaveHomeworkBtn'),
                    document.getElementById('continueBtn')
                ];
                const finalBtn = exitButtons.find(b => isElementVisible(b));

                if (finalBtn) {
                    updateStatus('Dokončeno! Klikám na tlačítko pro návrat...');
                    await sleep(getRandomDelay());

                    const a = finalBtn.tagName === 'A' ? finalBtn : finalBtn.closest('a');
                    if (a && a.href) {
                        window.location.href = a.href;
                        return;
                    }

                    realClick(finalBtn);
                    finalBtn.click();

                    // Fallback to ensure we return to the class packages page even if WocaBee handler doesn't redirect
                    setTimeout(() => {
                        if (config.enabled) {
                            const leaveWrapper = document.getElementById('leaveBtnWrapper');
                            if (leaveWrapper && leaveWrapper.href) {
                                window.location.href = leaveWrapper.href;
                            } else {
                                const classId = new URLSearchParams(window.location.search).get('class_id');
                                if (classId) {
                                    window.location.href = 'https://www.wocabee.app/app/student/class/?class_id=' + classId;
                                }
                            }
                        }
                    }, 1500);
                    return;
                }

                updateStatus('Hotovo! Čekám na tlačítko pro návrat...');
                return;
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

            // Check specific WocaBee next buttons after mistake/info
            const incorrectNextBtn = document.getElementById('incorrect-next-button');
            if (incorrectNextBtn && incorrectNextBtn.offsetParent !== null && !incorrectNextBtn.disabled) {
                updateStatus('Pokračuji (po chybě)...');
                await sleep(getRandomDelay());
                realClick(incorrectNextBtn);
                return;
            }

            const continueBtn = document.getElementById('continueBtn');
            if (continueBtn && continueBtn.offsetParent !== null && !continueBtn.disabled) {
                updateStatus('Pokračuji...');
                await sleep(getRandomDelay());
                realClick(continueBtn);
                return;
            }

            const nextKeywords = ['dále', 'dale', 'další', 'dalsi', 'next', 'continue', 'pokračovat', 'pokracovat'];
            const actionButtons = Array.from(document.querySelectorAll('.btn-success:not([disabled]), .btn-primary:not([disabled]), .btn-info:not([disabled]), .btn-block:not([disabled])'))
                .filter(b => b.offsetParent !== null);
            for (let btn of actionButtons) {
                const text = btn.innerText.toLowerCase();
                if (nextKeywords.some(kw => text.includes(kw))) {
                    updateStatus('Pokračuji...');
                    await sleep(getRandomDelay());
                    realClick(btn);
                    return;
                }
            }

            const nextBtn = document.getElementById('nextBtn');
            if (nextBtn && nextBtn.offsetParent !== null && !nextBtn.disabled) {
                updateStatus('Pokračuji (nextBtn)...');
                await sleep(getRandomDelay());
                realClick(nextBtn);
                return;
            }

            updateStatus('Čekám...');
            updateDebug('');
            return;
        }

        let isError = false;
        if (config.makeError && (Math.random() * 100 < config.errorRate)) {
            isError = true;
        }

        if (isError) {
            updateStatus('Záměrná chyba...');
            updateDebug('Záměrná chyba (' + config.errorRate + '%)');
        } else {
            updateStatus('Typ cvičení: ' + active.type);
        }

        const answer = getAnswer(active.type);
        if (!answer && !['pexeso', 'findPair', 'matchPair', 'choosePicture', 'listenAndChoose'].includes(active.type)) {
            updateDebug('Odpověď nenalezena');
            return;
        }

        if (!isError) {
            updateDebug('Odpověď: ' + (answer || 'N/A'));
        }
        await sleep(getRandomDelay());

        switch (active.type) {
            case 'translate':
                fillInput('translateWordAnswer', isError ? makeWrongText(answer) : answer);
                clickButton('translateWordSubmitBtn');
                break;
            case 'describePicture':
                fillInput('describePictureAnswer', isError ? makeWrongText(answer) : answer);
                clickButton('describePictureSubmitBtn');
                break;
            case 'transcribe':
                fillInput('transcribeAnswerWord', isError ? makeWrongText(answer) : answer);
                clickButton('transcribeSubmitBtn');
                break;
            case 'translateFalling':
                fillInput('translateFallingWordAnswer', isError ? makeWrongText(answer) : answer);
                clickButton('translateFallingWordSubmitBtn');
                break;
            case 'complete':
                await handleCompleteWord(answer, isError);
                break;
            case 'choice':
                handleChoice(answer, '#chooseWords .btn', isError);
                break;
            case 'listenAndChoose':
                let skipBtn = document.getElementById('listenAndChooseSkipBtn');
                if (skipBtn && skipBtn.offsetParent !== null && !isError) {
                    realClick(skipBtn);
                } else {
                    handleChoice(answer, '#listenAndChooseWords .btn', isError);
                }
                break;
            case 'chooseSpelling':
                handleChoice(answer, '#chooseSpellingWords .btn', isError);
                break;
            case 'pexeso':
                await handlePexeso(isError);
                break;
            case 'oneOutOfMany':
                handleChoice(answer, '#oneOutOfManyWords .btn', isError);
                break;
            case 'findPair':
                await handleFindPair(isError);
                break;
            case 'matchPair':
                await handleMatchPair(isError);
                break;
            case 'missing':
                fillInput('missingWordAnswer', isError ? makeWrongText(answer) : answer);
                clickButton('addMissingWordSubmitBtn');
                break;
            case 'choosePicture':
                await handleChoosePicture(isError);
                break;
            case 'arrangeWords':
                await handleArrangeWords(answer, isError);
                break;
        }
    }

    function makeWrongText(text) {
        if (!text || text.length === 0) return 'x';
        if (text.length === 1) return text.toLowerCase() === 'a' ? 'b' : 'a';

        const rand = Math.random();
        let arr = text.split('');

        if (rand < 0.4 && arr.length > 2) {
            let idx = Math.floor(Math.random() * (arr.length - 1));
            let temp = arr[idx];
            arr[idx] = arr[idx + 1];
            arr[idx + 1] = temp;
            if (arr.join('') !== text) return arr.join('');
        }

        if (rand < 0.8) {
            let idx = Math.floor(Math.random() * arr.length);
            let char = arr[idx].toLowerCase();
            let replacement = 'x';
            if (char === 'x') replacement = 'y';
            else if (char === 'e') replacement = 'i';
            else if (char === 'a') replacement = 'o';
            arr[idx] = (arr[idx] === arr[idx].toUpperCase()) ? replacement.toUpperCase() : replacement;
            return arr.join('');
        }

        if (arr.length > 3) {
            let idx = Math.floor(Math.random() * arr.length);
            arr.splice(idx, 1);
            return arr.join('');
        } else {
            return text + 'x';
        }
    }

    async function handleChoosePicture(isError = false) {
        const wordIdEl = document.getElementById('word_id');
        const targetWordId = wordIdEl ? wordIdEl.value : null;
        if (!targetWordId) return;

        const images = Array.from(document.querySelectorAll('#choosePicture .picture'))
            .filter(img => img.offsetParent !== null);
        if (images.length === 0) return;

        let targetImg = null;
        if (isError && images.length > 1) {
            const wrongImages = images.filter(img => img.getAttribute('word_id') !== targetWordId);
            if (wrongImages.length > 0) {
                targetImg = wrongImages[Math.floor(Math.random() * wrongImages.length)];
            }
        }

        if (!targetImg) {
            targetImg = images.find(img => img.getAttribute('word_id') === targetWordId);
        }

        if (targetImg) {
            updateDebug(isError ? 'Klikám na špatný obrázek (chyba)' : 'Klikám na obrázek');
            realClick(targetImg);
            await sleep(200);
            realClick(targetImg);
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

        if (['choice', 'oneOutOfMany', 'chooseSpelling', 'translate', 'translateFalling'].includes(type)) {
            let qId = 'ch_word';
            if (type === 'oneOutOfMany') qId = 'oneOutOfManyQuestionWord';
            else if (type === 'chooseSpelling') qId = 'cs_word';
            else if (type === 'translate') qId = 'tw_word';
            else if (type === 'translateFalling') qId = 'tfw_word';
            
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
                    let q = question.toLowerCase();
                    let t = match.translation.toLowerCase();
                    
                    if (q === t) {
                        return match.word;
                    }
                    return match.translation;
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

        if (type === 'listenAndChoose' && wordData) {
            // Options are usually the translation. 
            // We can determine which one by checking if aWord is the translation.
            if (aWord && aWord.trim().toLowerCase() === wordData.translation.trim().toLowerCase()) {
                return wordData.word;
            }
            return wordData.translation;
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

    function handleChoice(answer, selector, isError = false) {
        const options = Array.from(document.querySelectorAll(selector))
            .filter(o => o.offsetParent !== null && !o.disabled);
        if (options.length === 0) return;

        if (isError && options.length > 1) {
            const wrongOptions = options.filter(o => !answer || o.innerText.trim().toLowerCase() !== answer.trim().toLowerCase());
            if (wrongOptions.length > 0) {
                const randomWrong = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
                realClick(randomWrong);
                return;
            }
        }

        if (!answer) return;
        const opt = options.find(o => o.innerText.trim().toLowerCase() === answer.trim().toLowerCase());
        if (opt) realClick(opt);
    }

    async function handleCompleteWord(answer, isError = false) {
        if (!answer) return;
        const patternEl = document.getElementById('completeWordAnswer');
        if (!patternEl) return;
        const pattern = patternEl.innerText.trim();

        let errorInjected = false;

        for (let i = 0; i < pattern.length; i++) {
            if (pattern[i] === '_') {
                const targetChar = answer[i];
                let availableChars = Array.from(document.querySelectorAll('#characters .char, #characters .keyboardChar, #characters .btn'))
                    .filter(c => c.offsetParent !== null && c.style.visibility !== 'hidden' && c.getAttribute('is_hidden') !== '1');

                if (isError && !errorInjected) {
                    const wrongChars = availableChars.filter(c => c.innerText.trim() !== targetChar);
                    if (wrongChars.length > 0) {
                        const randomWrong = wrongChars[Math.floor(Math.random() * wrongChars.length)];
                        realClick(randomWrong);
                        errorInjected = true;
                        await sleep(150);
                        continue;
                    }
                }

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

    async function handleFindPair(isError = false) {
        const qWords = Array.from(document.querySelectorAll('#q_words .btn, .fp_q'))
            .filter(b => b.offsetParent !== null && !b.disabled && !b.classList.contains('btn-success-active'));
        const aWords = Array.from(document.querySelectorAll('#a_words .btn, .fp_a'))
            .filter(b => b.offsetParent !== null && !b.disabled && !b.classList.contains('btn-success-active'));

        if (qWords.length === 0 || aWords.length === 0) return;

        if (isError) {
            const qBtn = qWords[0];
            const wId = qBtn.getAttribute('w_id');
            const wrongABtn = aWords.find(btn => btn.getAttribute('w_id') !== wId);
            if (wrongABtn) {
                updateDebug('Chyba: Spojuji neshodná slova');
                realClick(qBtn);
                await sleep(300);
                realClick(wrongABtn);
                await sleep(100);
                return;
            }
        }

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

    async function handleMatchPair(isError = false) {
        const btns = Array.from(document.querySelectorAll('#matchPairWords .btn'))
            .filter(b => b.offsetParent !== null && !b.disabled && !b.classList.contains('btn-success-active'));

        if (isError && btns.length >= 2) {
            let b1 = btns[0];
            let wId1 = b1.getAttribute('w_id');
            let b2 = btns.find(b => b.getAttribute('w_id') !== wId1);
            if (b2) {
                updateDebug('Chyba: Spojuji neshodná slova');
                realClick(b1);
                await sleep(300);
                realClick(b2);
                await sleep(100);
                return;
            }
        }

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

    async function handleArrangeWords(answer, isError = false) {
        if (!answer) return;
        let words = answer.split(' ');
        const container = document.getElementById('sortableWords');
        if (!container) return;

        const items = Array.from(container.children);
        
        if (isError && words.length > 1) {
            let temp = words[0];
            words[0] = words[1];
            words[1] = temp;
        }

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

    async function handlePexeso(isError = false) {
        const cards = Array.from(document.querySelectorAll('.pexesoCardWrapper'));
        if (cards.length === 0) return;

        let available = cards.filter(card => 
            card.style.visibility !== 'hidden' && 
            card.offsetParent !== null && 
            card.getAttribute('marked') !== '1'
        );

        if (isError && available.length >= 2) {
            let c1 = available[0];
            let wId1 = c1.getAttribute('w_id');
            let c2 = available.find(c => c.getAttribute('w_id') !== wId1);
            if (c2) {
                const card1 = c1.querySelector('.pexesoFront');
                const card2 = c2.querySelector('.pexesoFront');
                if (card1 && card2) {
                    updateDebug('Chyba: Otevírám neshodný pár');
                    realClick(card1);
                    await sleep(300);
                    realClick(card1);
                    await sleep(300);
                    realClick(card2);
                    await sleep(300);
                    realClick(card2);
                    await sleep(800);
                    return;
                }
            }
        }

        let groups = {};
        available.forEach(card => {
            const wId = card.getAttribute('w_id');
            if (!groups[wId]) groups[wId] = [];
            groups[wId].push(card);
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