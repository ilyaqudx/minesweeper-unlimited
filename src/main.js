import './style.css';
import { MinesweeperGame, DIFFICULTY_PRESETS } from './minesweeper-engine.js';
import { audio } from './audio.js';

// DOM Elements
const gridEl = document.getElementById('minesweeper-grid');
const minesCountEl = document.getElementById('mines-display');
const timerEl = document.getElementById('timer-display');
const smileyBtnEl = document.getElementById('smiley-btn');
const diffBtns = document.querySelectorAll('.diff-btn');
const toggleFlagModeBtn = document.getElementById('btn-toggle-flag-mode');
const flagModeIconEl = document.getElementById('flag-mode-icon');
const flagModeTextEl = document.getElementById('flag-mode-text');

const btnSoundEl = document.getElementById('btn-sound');
const soundIconEl = document.getElementById('sound-icon');
const btnHelpEl = document.getElementById('btn-help');

const modalVictoryEl = document.getElementById('modal-victory');
const victoryTimeEl = document.getElementById('victory-time');
const btnPlayAgainVictory = document.getElementById('btn-play-again-victory');

const modalGameOverEl = document.getElementById('modal-gameover');
const btnTryAgainLoss = document.getElementById('btn-try-again-loss');
const modalHelpEl = document.getElementById('modal-help');

// Game State
let currentDiff = 'beginner';
let game = new MinesweeperGame(
  DIFFICULTY_PRESETS.beginner.rows,
  DIFFICULTY_PRESETS.beginner.cols,
  DIFFICULTY_PRESETS.beginner.mines
);
let isFlagMode = false; // For mobile touch toggle

// Audio Setup
function updateSoundIcon() {
  soundIconEl.textContent = audio.isMuted() ? '🔇' : '🔊';
}
updateSoundIcon();
btnSoundEl.addEventListener('click', () => {
  audio.toggleMute();
  updateSoundIcon();
});

// Update Displays
function updateCounters() {
  const rem = game.getRemainingMines();
  minesCountEl.textContent = String(rem).padStart(3, '0');
  timerEl.textContent = String(game.elapsedTime).padStart(3, '0');
}

// Build DOM Grid
function renderGrid() {
  gridEl.innerHTML = '';
  gridEl.style.gridTemplateColumns = `repeat(${game.cols}, 30px)`;

  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      const cell = game.grid[r][c];
      const cellEl = document.createElement('div');
      cellEl.className = 'mine-cell';
      cellEl.dataset.r = r;
      cellEl.dataset.c = c;

      updateCellElement(cellEl, cell);

      // Left Click (or Tap)
      cellEl.addEventListener('click', (e) => {
        e.preventDefault();
        if (isFlagMode) {
          handleToggleFlag(r, c);
        } else {
          handleCellClick(r, c);
        }
      });

      // Right Click (Flag)
      cellEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleToggleFlag(r, c);
      });

      // Mouse Down / Up for Smiley Face React
      cellEl.addEventListener('mousedown', (e) => {
        if (e.button === 0 && game.status === 'playing') {
          smileyBtnEl.textContent = '😮';
        }
      });

      gridEl.appendChild(cellEl);
    }
  }

  updateCounters();
}

window.addEventListener('mouseup', () => {
  if (game.status === 'playing') {
    smileyBtnEl.textContent = '😀';
  }
});

function updateCellElement(cellEl, cell) {
  if (cell.isRevealed) {
    cellEl.classList.add('revealed');
    if (cell.isMine) {
      cellEl.textContent = '💣';
      if (cell.isExploded) {
        cellEl.classList.add('exploded');
      }
    } else if (cell.neighborMines > 0) {
      cellEl.textContent = cell.neighborMines;
      cellEl.dataset.num = cell.neighborMines;
    } else {
      cellEl.textContent = '';
      delete cellEl.dataset.num;
    }
  } else if (cell.isFlagged) {
    cellEl.textContent = '🚩';
  } else {
    cellEl.textContent = '';
    cellEl.classList.remove('revealed', 'exploded');
    delete cellEl.dataset.num;
  }
}

// Action: Click Cell
function handleCellClick(r, c) {
  const cell = game.grid[r][c];
  if (cell.isRevealed && cell.neighborMines > 0) {
    // Chord click
    const res = game.chord(r, c, (t) => { timerEl.textContent = String(t).padStart(3, '0'); });
    if (res.action !== 'none') {
      audio.playClick();
      refreshBoard();
      checkEndState(res.action);
    }
    return;
  }

  const res = game.reveal(r, c, (t) => { timerEl.textContent = String(t).padStart(3, '0'); });
  if (res.action === 'none') return;

  if (res.action === 'lost') {
    audio.playExplosion();
    smileyBtnEl.textContent = '😵';
    refreshBoard();
    setTimeout(() => { modalGameOverEl.hidden = false; }, 600);
  } else if (res.action === 'won') {
    audio.playWin();
    smileyBtnEl.textContent = '😎';
    victoryTimeEl.textContent = `${game.elapsedTime} seconds`;
    refreshBoard();
    setTimeout(() => { modalVictoryEl.hidden = false; }, 400);
  } else {
    audio.playClick();
    refreshBoard();
  }
}

function handleToggleFlag(r, c) {
  if (game.toggleFlag(r, c)) {
    audio.playFlag();
    const cellEl = gridEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    if (cellEl) updateCellElement(cellEl, game.grid[r][c]);
    updateCounters();
  }
}

function refreshBoard() {
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      const cellEl = gridEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
      if (cellEl) updateCellElement(cellEl, game.grid[r][c]);
    }
  }
  updateCounters();
}

function checkEndState(action) {
  if (action === 'lost') {
    audio.playExplosion();
    smileyBtnEl.textContent = '😵';
    setTimeout(() => { modalGameOverEl.hidden = false; }, 600);
  } else if (action === 'won') {
    audio.playWin();
    smileyBtnEl.textContent = '😎';
    victoryTimeEl.textContent = `${game.elapsedTime} seconds`;
    setTimeout(() => { modalVictoryEl.hidden = false; }, 400);
  }
}

// Smiley Face / Restart
smileyBtnEl.addEventListener('click', restartGame);
btnPlayAgainVictory.addEventListener('click', () => {
  modalVictoryEl.hidden = true;
  restartGame();
});
btnTryAgainLoss.addEventListener('click', () => {
  modalGameOverEl.hidden = true;
  restartGame();
});

function restartGame() {
  modalVictoryEl.hidden = true;
  modalGameOverEl.hidden = true;
  smileyBtnEl.textContent = '😀';
  game.initBoard();
  renderGrid();
}

// Difficulty Selector
diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    diffBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDiff = btn.dataset.diff;
    const cfg = DIFFICULTY_PRESETS[currentDiff];
    game = new MinesweeperGame(cfg.rows, cfg.cols, cfg.mines);
    restartGame();
  });
});

// Mobile Flag Mode Toggle
toggleFlagModeBtn.addEventListener('click', () => {
  isFlagMode = !isFlagMode;
  toggleFlagModeBtn.classList.toggle('active', isFlagMode);
  flagModeIconEl.textContent = isFlagMode ? '🚩' : '⛏️';
  flagModeTextEl.textContent = isFlagMode ? 'Flag Mode' : 'Dig Mode';
});

// Help Modal
btnHelpEl.addEventListener('click', () => { modalHelpEl.hidden = false; });
document.querySelectorAll('.modal-close').forEach(b => {
  b.addEventListener('click', () => { modalHelpEl.hidden = true; });
});
modalHelpEl.addEventListener('click', (e) => {
  if (e.target === modalHelpEl) modalHelpEl.hidden = true;
});

// Initial Render
renderGrid();
