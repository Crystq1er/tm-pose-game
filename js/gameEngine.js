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

  start() {
    this.isGameActive = true;
    this.score = 0;
    this.level = 1;
    this.lives = 3; // 생명 3개로 시작
    this.hasShield = false;

    this.items = [];
    this.currentPose = "Center";
    this.itemSpawnTimer = 0;
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

    // 3. 아이템 이동 및 충돌
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += item.speed * deltaTime;

      // 화면 아래로 벗어남
      if (item.y > this.canvas.height) {
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

    // 폭탄 비율 증가 (30%)
    // 선물상자: 매우 희귀 (1%)
    // 쉴드: 희귀 (2%)
    if (rand < 0.01) {
      type = "gift";
    } else if (rand < 0.03) {
      type = "shield";
    } else if (rand < 0.33) {
      type = "bomb";
    } else if (rand < 0.6) {
      type = "grape";
    } else if (rand < 0.8) {
      type = "orange";
    } else {
      type = "apple";
    }

    // 레벨에 따른 속도 증가
    const speed = this.baseSpeed * (1 + (this.level * 0.1));

    this.items.push({
      x: x,
      y: -50,
      type: type,
      speed: speed
    });
  }

  checkCollision(item) {
    const dist = Math.hypot(this.basket.x - item.x, this.basket.y - item.y);
    return dist < (this.basket.width / 2 + 20);
  }

  handleItemCollection(item) {
    let scoreDelta = 0;

    switch (item.type) {
      case "apple": scoreDelta = 100; break;
      case "orange": scoreDelta = 200; break;
      case "grape": scoreDelta = 300; break;
      case "gift": scoreDelta = 1000; break; // 대박 점수

      case "shield":
        this.hasShield = true;
        if (this.onLivesChange) this.onLivesChange(this.lives, this.hasShield);
        break;

      case "bomb":
        if (this.hasShield) {
          this.hasShield = false; // 쉴드 파괴
        } else {
          this.lives--; // 생명 감소
          if (this.lives <= 0) {
            this.stop(); // 게임 오버
            return;
          }
        }
        if (this.onLivesChange) this.onLivesChange(this.lives, this.hasShield);
        // 폭탄은 점수 변동 없음 (생존이 목적)
        break;
    }

    this.score += scoreDelta;
    if (this.score < 0) this.score = 0;

    // 레벨업 (1000점 마다)
    if (this.score >= this.level * 1000) {
      this.level++;
      this.spawnInterval = Math.max(300, 1000 - (this.level * 50));
    }

    if (this.onScoreChange) {
      this.onScoreChange(this.score, this.level);
    }
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

      ctx.font = "50px sans-serif";
      ctx.fillText(icon, item.x, item.y);
    });
  }

  onPoseDetected(detectedPose) {
    this.currentPose = detectedPose;
  }

  setScoreChangeCallback(callback) { this.onScoreChange = callback; }
  setGameEndCallback(callback) { this.onGameEnd = callback; }
  setLivesChangeCallback(callback) { this.onLivesChange = callback; }
}

window.GameEngine = GameEngine;
