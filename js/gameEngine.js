/**
 * gameEngine.js
 * Fruit Catcher: Survival Mode
 * - 무제한 시간
 * - 생명 3개 (폭탄 피격 시 감소)
 * - 쉴드 아이템 (폭탄 1회 방어)
 * - 선물상자 (희귀, 고득점)
 */

class GameEngine {
  constructor() {
    this.score = 0;
    this.level = 1;
    this.currentPose = "Center";
    this.isGameActive = false;
    this.gameLoopId = null;
    this.lastTime = 0;

    // Survival Mode 상태 변수
    this.lives = 3;
    this.hasShield = false;

    // 게임 오브젝트
    this.items = [];
    this.itemSpawnTimer = 0;
    this.spawnInterval = 1000;
    this.baseSpeed = 200;

    // 플레이어
    this.basket = {
      x: 0,
      y: 0,
      width: 80,
      height: 80,
    };

    // Callbacks
    this.onScoreChange = null;
    this.onGameEnd = null;
    this.onLivesChange = null; // 생명/쉴드 변경 시 호출

    this.ctx = null;
    this.canvas = null;

    this.stage = 1;
    this.controlMode = 'camera';
    this.stageGoal = 2000;
    this.onStageClear = null;
  }

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = this.canvas.parentElement.clientWidth;
    this.canvas.height = this.canvas.parentElement.clientHeight;
  }

  start(stage = 1, controlMode = 'camera') {
    this.isGameActive = true;
    this.score = 0;
    this.level = 1;
    this.lives = 3; // 생명 3개로 시작
    this.hasShield = false;
    this.stage = stage;
    this.controlMode = controlMode;

    // Stage Goal Calculation: 2000 + (Stage-1)*500
    // Stage 1: 2000, Stage 2: 2500 ...
    this.stageGoal = 2000 + (this.stage - 1) * 500;

    this.items = [];
    this.currentPose = "Center";
    this.itemSpawnTimer = 0;
    this.baseSpeed = 200;
    this.spawnInterval = 1000;

    this.consecutiveMisses = 0; // 연속 놓침 카운트
    this.baseSpeed = 200;
    this.spawnInterval = 1000;

    this.lastTime = performance.now();

    // 초기 UI 반영
    if (this.onLivesChange) this.onLivesChange(this.lives, this.hasShield);
    if (this.onScoreChange) this.onScoreChange(this.score, this.level);

    this.loop();
  }

  stop(triggerEvent = true) {
    this.isGameActive = false;
    if (this.gameLoopId) {
      cancelAnimationFrame(this.gameLoopId);
    }
    // 게임 오버 알림
    if (triggerEvent && this.onGameEnd) {
      // 렌더링 루프가 멈춘 뒤 실행되도록 잠시 대기
      setTimeout(() => {
        this.onGameEnd(this.score, this.level);
      }, 50);
    }
  }

  loop() {
    if (!this.isGameActive) return;

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();

    this.gameLoopId = requestAnimationFrame(() => this.loop());
  }

  update(deltaTime) {
    // 1. 아이템 생성
    this.itemSpawnTimer += deltaTime * 1000;
    if (this.itemSpawnTimer > this.spawnInterval) {
      this.spawnItem();
      this.itemSpawnTimer = 0;
    }

    // 2. 바구니 이동
    this.updateBasketPosition();

    // 2-1. Fever Timer (Update logic)
    if (this.isFeverMode) {
      this.feverTimer -= deltaTime;
      if (this.feverTimer <= 0) {
        this.isFeverMode = false;
      }
    }

    // 3. 아이템 이동 및 충돌
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += item.speed * deltaTime;

      // 화면 아래로 벗어남
      if (item.y > this.canvas.height) {
        // 과일을 놓쳤는지 체크 (폭탄, 하트 등 제외)
        if (["apple", "orange", "grape"].includes(item.type)) {
          this.handleFruitMiss();
        }
        this.items.splice(i, 1);
        continue;
      }

      // 충돌 체크
      if (this.checkCollision(item)) {
        this.handleItemCollection(item);
        this.items.splice(i, 1);
      }
    }
  }

  handleFruitMiss() {
    this.consecutiveMisses++;
    if (this.consecutiveMisses >= 2) {
      // 2번 연속 놓침 -> 생명 감소
      this.lives--;
      this.consecutiveMisses = 0; // 리셋

      // UI 알림 (임시: 흔들기 효과 등은 나중에)
      if (this.onLivesChange) this.onLivesChange(this.lives, this.hasShield);

      if (this.lives <= 0) {
        this.stop();
      }
    }
  }

  updateBasketPosition() {
    const zoneWidth = this.canvas.width / 3;
    let targetX = zoneWidth / 2;

    if (this.currentPose === "Left") {
      targetX = zoneWidth * 0.5;
    } else if (this.currentPose === "Right") {
      targetX = zoneWidth * 2.5;
    } else {
      targetX = zoneWidth * 1.5;
    }

    // 부드러운 보간 이동
    this.basket.x += (targetX - this.basket.x) * 0.2;
    this.basket.y = this.canvas.height - 100;
  }

  spawnItem() {
    const zones = ["Left", "Center", "Right"];
    const randomZone = zones[Math.floor(Math.random() * zones.length)];
    const zoneWidth = this.canvas.width / 3;

    let x = zoneWidth * 1.5;
    if (randomZone === "Left") x = zoneWidth * 0.5;
    if (randomZone === "Right") x = zoneWidth * 2.5;

    // 아이템 타입 확률 조정
    const rand = Math.random();
    let type = "apple";
    let speedMult = 1;

    // Control Mode Speed Modifier
    // Keyboard is easier, so make it faster
    if (this.controlMode === 'keyboard') {
      speedMult *= 1.6;
    }

    // FEVER MODE: 무조건 과일, 속도 빠름, 많이 나옴
    if (this.isFeverMode) {
      // Fever일 때는 좋은 과일 확률 UP
      const fRand = Math.random();
      if (fRand < 0.4) type = "orange"; // 40%
      else if (fRand < 0.7) type = "grape"; // 30%
      else type = "apple";

      speedMult *= 1.3; // 속도 1.3배
    } else {
      // Normal Mode
      // Difficulty Scaling based on Stage
      // Base Bomb Chance: 0.1 at Stage 1
      // Increase by 0.01 per stage. Max 0.5 (Stage 41+)
      let bombChance = 0.1 + (this.stage - 1) * 0.01;
      bombChance = Math.min(0.5, bombChance);

      if (rand < 0.01) {
        type = "gift";
      } else if (rand < 0.03) {
        type = "shield";
      } else if (rand < 0.04) {
        type = "heart"; // Heart Item (Very Rare)
      } else if (rand < 0.04 + bombChance) {
        type = "bomb";
      } else if (rand < 0.6) {
        type = "grape";
      } else if (rand < 0.8) {
        type = "orange";
      } else {
        type = "apple";
      }
    }

    // 레벨에 따른 속도 증가 + 스테이지에 따른 기저 속도 증가
    // Stage Speed Boost: +5% per stage
    const stageSpeedBoost = 1 + (this.stage - 1) * 0.05;
    const speed = this.baseSpeed * stageSpeedBoost * (1 + (this.level * 0.1)) * speedMult;

    this.items.push({
      x: x,
      y: -50,
      type: type,
      speed: speed
    });

    // Bomb Trap Logic: 30% chance to spawn a bomb near a fruit
    if (["apple", "orange", "grape"].includes(type) && !this.isFeverMode) {
      if (Math.random() < 0.3) {
        this.items.push({
          x: x, // Same column
          y: -50 - (Math.random() * 100 + 120), // Slightly behind (or could be front)
          type: "bomb",
          speed: speed // Same speed
        });
      }
    }
  }

  checkCollision(item) {
    const dist = Math.hypot(this.basket.x - item.x, this.basket.y - item.y);
    return dist < (this.basket.width / 2 + 20);
  }

  handleItemCollection(item) {
    let scoreDelta = 0;

    switch (item.type) {
      case "apple":
      case "orange":
      case "grape":
        scoreDelta = (item.type === "apple" ? 100 : (item.type === "orange" ? 200 : 300));
        this.consecutiveMisses = 0; // 과일 먹으면 리셋
        break;

      case "gift":
        scoreDelta = 500;
        this.activateFever();
        break; // Fever Mode Trigger

      case "heart":
        this.lives = Math.min(3, this.lives + 1); // Max 3
        if (this.onLivesChange) this.onLivesChange(this.lives, this.hasShield);
        break;

      case "shield":
        this.hasShield = true;
        if (this.onLivesChange) this.onLivesChange(this.lives, this.hasShield);
        break;

      case "bomb":
        if (this.hasShield) {
          this.hasShield = false; // 쉴드 파괴
        } else {
          this.lives--; // 생명 감소
          this.consecutiveMisses = 0; // 폭탄 맞아도 리셋 (선택사항, 보통은 리셋해줌)
          if (this.lives <= 0) {
            this.stop(); // 게임 오버
            return;
          }
        }
        if (this.onLivesChange) this.onLivesChange(this.lives, this.hasShield);
        break;
    }

    this.score += scoreDelta;
    if (this.score < 0) this.score = 0;

    // 레벨업 (1000점 마다)
    if (this.score >= this.level * 1000) {
      this.level++;
      if (!this.isFeverMode) {
        this.spawnInterval = Math.max(300, 1000 - (this.level * 50));
      }
    }

    if (this.onScoreChange) {
      this.onScoreChange(this.score, this.level);
    }

    // Check Stage Clear
    if (this.score >= this.stageGoal) {
      this.stop(false); // Stop without Game Over event
      if (this.onStageClear) {
        this.onStageClear(this.stage);
      }
    }
  }

  activateFever() {
    this.isFeverMode = true;
    this.feverTimer = 5.0; // 5 seconds
    this.spawnInterval = 200; // Very fast spawn
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 구역 라인
    const zoneWidth = this.canvas.width / 3;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.beginPath();
    ctx.moveTo(zoneWidth, 0);
    ctx.lineTo(zoneWidth, this.canvas.height);
    ctx.moveTo(zoneWidth * 2, 0);
    ctx.lineTo(zoneWidth * 2, this.canvas.height);
    ctx.stroke();

    // 쉴드 이펙트
    if (this.hasShield) {
      ctx.save();
      ctx.fillStyle = "rgba(100, 200, 255, 0.3)";
      ctx.strokeStyle = "#00ffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.basket.x, this.basket.y, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 바구니
    ctx.fillStyle = "#FFD700";
    ctx.font = "60px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🧺", this.basket.x, this.basket.y);

    // 아이템
    this.items.forEach(item => {
      let icon = "🍎";
      if (item.type === "orange") icon = "🍊";
      if (item.type === "grape") icon = "🍇";
      if (item.type === "bomb") icon = "💣";
      if (item.type === "gift") icon = "🎁";
      if (item.type === "shield") icon = "🛡️";
      if (item.type === "heart") icon = "❤️";

      ctx.font = "50px sans-serif";
      ctx.fillText(icon, item.x, item.y);
    });
  }

  onPoseDetected(detectedPose) {
    this.currentPose = detectedPose;
  }

  setScoreChangeCallback(callback) { this.onScoreChange = callback; }
  setGameEndCallback(callback) { this.onGameEnd = callback; }
  setScoreChangeCallback(callback) { this.onScoreChange = callback; }
  setGameEndCallback(callback) { this.onGameEnd = callback; }
  setLivesChangeCallback(callback) { this.onLivesChange = callback; }
  setStageClearCallback(callback) { this.onStageClear = callback; }
}

window.GameEngine = GameEngine;
