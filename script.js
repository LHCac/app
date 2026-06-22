"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreDisplay = document.getElementById("score-display");
const levelDisplay = document.getElementById("level-display");
const livesDisplay = document.getElementById("lives-display");
const startOverlay = document.getElementById("start-overlay");
const gameoverOverlay = document.getElementById("gameover-overlay");
const finalScore = document.getElementById("final-score");
const evaluationText = document.getElementById("evaluation-text");
const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");
const btnLeft = document.getElementById("btn-left");
const btnRight = document.getElementById("btn-right");

const INITIAL_LIVES = 3;
const BASE_SPAWN_INTERVAL = 60;

const basket = {
    x: 160,
    y: 350,
    width: 80,
    height: 25,
    speed: 7,
    emoji: "🧺"
};

const itemsConfig = {
    good: [
        { emoji: "🍎", score: 10, type: "good" },
        { emoji: "🍌", score: 10, type: "good" },
        { emoji: "🥦", score: 10, type: "good" },
        { emoji: "🥕", score: 10, type: "good" },
        { emoji: "🐟", score: 15, type: "good" }
    ],
    gold: [
        { emoji: "🌟", score: 30, type: "gold" },
        { emoji: "👑", score: 50, type: "gold" }
    ],
    bad: [
        { emoji: "💣", score: -10, type: "bad" },
        { emoji: "🍟", score: -10, type: "bad" },
        { emoji: "🍩", score: -10, type: "bad" }
    ]
};

let score = 0;
let lives = INITIAL_LIVES;
let level = 1;
let gameRunning = false;
let fallingItems = [];
let spawnTimer = 0;
let spawnInterval = BASE_SPAWN_INTERVAL;
let animationFrameId = null;
let audioCtx = null;

const keys = {
    Left: false,
    Right: false
};

function setupControls() {
    bindHoldControl(btnLeft, "Left");
    bindHoldControl(btnRight, "Right");

    window.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft" || event.key === "Left") {
            event.preventDefault();
            setDirection("Left", true);
        }
        if (event.key === "ArrowRight" || event.key === "Right") {
            event.preventDefault();
            setDirection("Right", true);
        }
    });

    window.addEventListener("keyup", (event) => {
        if (event.key === "ArrowLeft" || event.key === "Left") {
            setDirection("Left", false);
        }
        if (event.key === "ArrowRight" || event.key === "Right") {
            setDirection("Right", false);
        }
    });

    window.addEventListener("blur", releaseControls);
    startButton.addEventListener("click", startGame);
    restartButton.addEventListener("click", startGame);
}

function bindHoldControl(button, direction) {
    const press = (event) => {
        event.preventDefault();
        setDirection(direction, true);
    };
    const release = (event) => {
        event.preventDefault();
        setDirection(direction, false);
    };

    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
}

function setDirection(direction, isPressed) {
    keys[direction] = isPressed;
    const button = direction === "Left" ? btnLeft : btnRight;
    button.classList.toggle("is-active", isPressed);
}

function releaseControls() {
    setDirection("Left", false);
    setDirection("Right", false);
}

function initAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx && AudioContextClass) {
        audioCtx = new AudioContextClass();
    }

    if (audioCtx?.state === "suspended") {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!audioCtx) {
        return;
    }

    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    if (type === "catch_good") {
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(440, now);
        oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.16);
    } else if (type === "catch_gold") {
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(660, now);
        oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.2);
    } else {
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(180, now);
        oscillator.frequency.exponentialRampToValueAtTime(80, now + 0.2);
    }

    oscillator.start(now);
    oscillator.stop(now + 0.22);
}

function resetGame() {
    score = 0;
    lives = INITIAL_LIVES;
    level = 1;
    fallingItems = [];
    spawnTimer = 0;
    spawnInterval = BASE_SPAWN_INTERVAL;
    basket.x = (canvas.width - basket.width) / 2;
    releaseControls();
    updateStatus();
}

function startGame() {
    if (gameRunning) {
        return;
    }

    initAudio();
    resetGame();
    startOverlay.classList.add("hidden");
    gameoverOverlay.classList.add("hidden");
    gameRunning = true;
    animationFrameId = requestAnimationFrame(gameLoop);
}

function createFallingItem() {
    const roll = Math.random();
    let group;

    if (roll < 0.65) {
        group = itemsConfig.good;
    } else if (roll < 0.8) {
        group = itemsConfig.gold;
    } else {
        group = itemsConfig.bad;
    }

    const config = group[Math.floor(Math.random() * group.length)];
    const size = 34;

    fallingItems.push({
        ...config,
        x: Math.random() * (canvas.width - size),
        y: -size,
        size,
        speed: 1.8 + level * 0.28 + Math.random() * 0.8
    });
}

function updateGame() {
    if (keys.Left) {
        basket.x -= basket.speed;
    }
    if (keys.Right) {
        basket.x += basket.speed;
    }
    basket.x = Math.max(0, Math.min(canvas.width - basket.width, basket.x));

    spawnTimer += 1;
    if (spawnTimer >= spawnInterval) {
        createFallingItem();
        spawnTimer = 0;
    }

    for (let index = fallingItems.length - 1; index >= 0; index -= 1) {
        const item = fallingItems[index];
        item.y += item.speed;

        if (isCaught(item)) {
            handleCatch(item);
            fallingItems.splice(index, 1);
            continue;
        }

        if (item.y > canvas.height) {
            fallingItems.splice(index, 1);
        }
    }

    level = Math.min(10, Math.floor(score / 100) + 1);
    spawnInterval = Math.max(24, BASE_SPAWN_INTERVAL - (level - 1) * 4);
    updateStatus();
}

function isCaught(item) {
    const itemBottom = item.y + item.size;
    const itemCenterX = item.x + item.size / 2;

    return itemBottom >= basket.y
        && item.y <= basket.y + basket.height
        && itemCenterX >= basket.x
        && itemCenterX <= basket.x + basket.width;
}

function handleCatch(item) {
    if (item.type === "bad") {
        lives -= 1;
        playSound("catch_bad");
        if (lives <= 0) {
            finishGame();
        }
        return;
    }

    score += item.score;
    playSound(item.type === "gold" ? "catch_gold" : "catch_good");
}

function updateStatus() {
    scoreDisplay.textContent = String(score);
    levelDisplay.textContent = String(level);
    livesDisplay.textContent = "❤️".repeat(Math.max(0, lives));
    livesDisplay.setAttribute("aria-label", `${Math.max(0, lives)} 條生命`);
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGuideLine();
    drawBasket();

    fallingItems.forEach((item) => {
        ctx.font = `${item.size}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(item.emoji, item.x, item.y);
    });
}

function drawGuideLine() {
    ctx.save();
    ctx.strokeStyle = "rgba(52, 73, 94, 0.12)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, basket.y + basket.height);
    ctx.lineTo(canvas.width, basket.y + basket.height);
    ctx.stroke();
    ctx.restore();
}

function drawBasket() {
    ctx.font = '58px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
        basket.emoji,
        basket.x + basket.width / 2,
        basket.y + basket.height / 2
    );
}

function gameLoop() {
    if (!gameRunning) {
        return;
    }

    updateGame();
    drawGame();

    if (gameRunning) {
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}

function finishGame() {
    gameRunning = false;
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    finalScore.textContent = String(score);
    evaluationText.textContent = getEvaluation(score);
    gameoverOverlay.classList.remove("hidden");
}

function getEvaluation(finalValue) {
    if (finalValue >= 300) {
        return "太厲害了！您的反應力與專注力都非常出色！";
    }
    if (finalValue >= 150) {
        return "表現很棒！再挑戰一次，很快就能突破新紀錄！";
    }
    if (finalValue >= 50) {
        return "做得很好！保持專注，下一次一定會更進步！";
    }
    return "完成挑戰就是很好的開始，慢慢熟悉節奏再試一次吧！";
}

setupControls();
updateStatus();
drawGame();
