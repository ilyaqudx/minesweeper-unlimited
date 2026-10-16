// High Performance Classic Minesweeper Engine

export const DIFFICULTY_PRESETS = {
  beginner: { name: 'Beginner', rows: 9, cols: 9, mines: 10 },
  intermediate: { name: 'Intermediate', rows: 16, cols: 16, mines: 40 },
  expert: { name: 'Expert', rows: 16, cols: 30, mines: 99 }
};

export class MinesweeperGame {
  constructor(rows = 9, cols = 9, mines = 10) {
    this.rows = rows;
    this.cols = cols;
    this.mineCount = mines;
    this.status = 'ready'; // 'ready' | 'playing' | 'won' | 'lost'
    this.grid = [];
    this.revealedCount = 0;
    this.flagCount = 0;
    this.startTime = null;
    this.elapsedTime = 0;
    this.timerInterval = null;
    this.firstClick = true;
    this.initBoard();
  }

  initBoard() {
    this.status = 'ready';
    this.firstClick = true;
    this.revealedCount = 0;
    this.flagCount = 0;
    this.elapsedTime = 0;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.startTime = null;

    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        row.push({
          r,
          c,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          isExploded: false,
          neighborMines: 0
        });
      }
      this.grid.push(row);
    }
  }

  // Populate mines ensuring safe zone around first clicked cell (r0, c0)
  populateMines(r0, c0) {
    const candidates = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        // Safe 3x3 box around first click
        if (Math.abs(r - r0) <= 1 && Math.abs(c - c0) <= 1) continue;
        candidates.push({ r, c });
      }
    }

    // Shuffle candidates
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const totalMines = Math.min(this.mineCount, candidates.length);
    for (let i = 0; i < totalMines; i++) {
      const { r, c } = candidates[i];
      this.grid[r][c].isMine = true;
    }

    // Calculate neighbor mine counts
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.grid[r][c].isMine) {
          this.grid[r][c].neighborMines = this.countNeighborMines(r, c);
        }
      }
    }
  }

  getNeighbors(r, c) {
    const neighbors = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
          neighbors.push(this.grid[nr][nc]);
        }
      }
    }
    return neighbors;
  }

  countNeighborMines(r, c) {
    return this.getNeighbors(r, c).filter(n => n.isMine).length;
  }

  startTimer(onTick) {
    this.startTime = Date.now();
    this.timerInterval = setInterval(() => {
      if (this.status === 'playing') {
        this.elapsedTime = Math.min(999, Math.floor((Date.now() - this.startTime) / 1000));
        if (onTick) onTick(this.elapsedTime);
      }
    }, 1000);
  }

  // Left Click: Reveal Cell
  reveal(r, c, onTick) {
    if (this.status === 'won' || this.status === 'lost') return { action: 'none' };
    const cell = this.grid[r][c];
    if (cell.isRevealed || cell.isFlagged) return { action: 'none' };

    // First click guarantee
    if (this.firstClick) {
      this.firstClick = false;
      this.status = 'playing';
      this.populateMines(r, c);
      this.startTimer(onTick);
    }

    // Hit a mine!
    if (cell.isMine) {
      cell.isRevealed = true;
      cell.isExploded = true;
      this.status = 'lost';
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.revealAllMines();
      return { action: 'lost', cell };
    }

    // Reveal empty or numbered cell
    const revealedCells = [];
    const queue = [cell];
    cell.isRevealed = true;
    this.revealedCount++;
    revealedCells.push(cell);

    while (queue.length > 0) {
      const current = queue.shift();
      if (current.neighborMines === 0) {
        for (const neighbor of this.getNeighbors(current.r, current.c)) {
          if (!neighbor.isRevealed && !neighbor.isFlagged && !neighbor.isMine) {
            neighbor.isRevealed = true;
            this.revealedCount++;
            revealedCells.push(neighbor);
            if (neighbor.neighborMines === 0) {
              queue.push(neighbor);
            }
          }
        }
      }
    }

    // Check Win
    const totalSafeCells = this.rows * this.cols - this.mineCount;
    if (this.revealedCount >= totalSafeCells) {
      this.status = 'won';
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.flagAllMines();
      return { action: 'won', revealedCells };
    }

    return { action: 'revealed', revealedCells };
  }

  // Right Click: Toggle Flag
  toggleFlag(r, c) {
    if (this.status === 'won' || this.status === 'lost') return false;
    const cell = this.grid[r][c];
    if (cell.isRevealed) return false;

    cell.isFlagged = !cell.isFlagged;
    this.flagCount += cell.isFlagged ? 1 : -1;
    return true;
  }

  // Chord Click on revealed numbered cell
  chord(r, c, onTick) {
    if (this.status !== 'playing') return { action: 'none' };
    const cell = this.grid[r][c];
    if (!cell.isRevealed || cell.neighborMines === 0) return { action: 'none' };

    const neighbors = this.getNeighbors(r, c);
    const flaggedNeighbors = neighbors.filter(n => n.isFlagged).length;

    // Only chord if flags match neighbor mine count
    if (flaggedNeighbors !== cell.neighborMines) return { action: 'none' };

    let hitMine = false;
    const revealedCells = [];

    for (const n of neighbors) {
      if (!n.isRevealed && !n.isFlagged) {
        const res = this.reveal(n.r, n.c, onTick);
        if (res.action === 'lost') {
          hitMine = true;
        } else if (res.action === 'revealed' || res.action === 'won') {
          revealedCells.push(...(res.revealedCells || []));
          if (res.action === 'won') return { action: 'won', revealedCells };
        }
      }
    }

    if (hitMine) return { action: 'lost' };
    return { action: 'chord', revealedCells };
  }

  revealAllMines() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell.isMine) cell.isRevealed = true;
      }
    }
  }

  flagAllMines() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell.isMine && !cell.isFlagged) {
          cell.isFlagged = true;
          this.flagCount++;
        }
      }
    }
  }

  getRemainingMines() {
    return Math.max(0, this.mineCount - this.flagCount);
  }
}
