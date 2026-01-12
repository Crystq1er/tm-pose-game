/**
 * gameEngine.js
 * Fruit Catcher 게임 로직 구현
 */

class GameEngine {
  constructor() {
    this.score = 0;
    this.level = 1;
    this.timeLimit = 60;
    this.currentPose = "Center"; // 현재 플레이어 포즈 (Left, Center, Right)
    this.isGameActive = false;
    this.gameLoopId = null;
    this.lastTime = 0;

    // 게임 오브젝트 설정
    this.items = []; // 낙하물 배열
    this.itemSpawnTimer = 0;
    this.spawnInterval = 2500; // 2.5초마다 생성 (초기값 증가)
    this.baseSpeed = 100; // 기본 낙하 속도 (200 -> 100으로 감소)

    // 피버 모드 상태
    this.isFeverMode = false;
    this.feverTimer = 0;
    this.feverDuration = 5; // 5초

    // 플레이어 바구니 설정
    this.basket = {
      x: 0,
      y: 0,
      width: 80,
      height: 80,
      zone: "Center" // 현재 위치 구역
    };

    // 상태 콜백
    this.onScoreChange = null;
    this.onGameEnd = null;
    this.onTimeUpdate = null;

    // 캔버스 컨텍스트
    this.ctx = null;
    this.canvas = null;
  }

  /**
   * 게임 초기화 및 시작
   * @param {HTMLCanvasElement} canvas - 게임 렌더링용 캔버스
   */
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.resizeCanvas();

    // 화면 크기 변경 시 캔버스 리사이징
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
    this.timeLimit = 60;
    this.items = [];
    this.currentPose = "Center";
    this.itemSpawnTimer = 0;

    // 난이도 재설정 (쉽게)
    this.baseSpeed = 100;
    this.spawnInterval = 2500;

    // 피버 모드 초기화
    this.isFeverMode = false;
    this.feverTimer = 0;

    this.lastTime = performance.now();
    this.loop();
  }

  stop() {
    this.isGameActive = false;
    if (this.gameLoopId) {
      cancelAnimationFrame(this.gameLoopId);
    }
    if (this.onGameEnd) {
      this.onGameEnd(this.score, this.level);
    }
  }

  /**
   * 메인 게임 루프
   */
  loop() {
    if (!this.isGameActive) return;

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000; // 초 단위
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();

    this.gameLoopId = requestAnimationFrame(() => this.loop());
  }

  /**
   * 게임 상태 업데이트
   * @param {number} deltaTime - 프레임 간격 (초)
   */
  update(deltaTime) {
    // 1. 시간 감소
    this.timeLimit -= deltaTime;
    if (this.onTimeUpdate) this.onTimeUpdate(Math.ceil(this.timeLimit));

    if (this.timeLimit <= 0) {
      this.stop();
      return;
    }

    // 1-1. 피버 모드 타이머
    if (this.isFeverMode) {
      this.feverTimer -= deltaTime;
      if (this.feverTimer <= 0) {
        this.isFeverMode = false;
        // 피버 종료 시 원래 스폰 간격으로 복구 (레벨 고려)
        this.spawnInterval = Math.max(500, 2500 - (this.level * 200));
      }
    }

    // 2. 아이템 생성
    this.itemSpawnTimer += deltaTime * 1000;

    // 피버 모드일 때는 생성 간격을 매우 짧게 (예: 100ms)
    const currentInterval = this.isFeverMode ? 100 : this.spawnInterval;

    if (this.itemSpawnTimer > currentInterval) {
      this.spawnItem();
      this.itemSpawnTimer = 0;
    }

    // 3. 아이템 이동 및 충돌 처리
    this.updateBasketPosition();

    // 역방향 반복을 통해 안전하게 삭제
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += item.speed * deltaTime;

      // 바닥에 닿으면 제거
      if (item.y > this.canvas.height) {
        this.items.splice(i, 1);
        continue;
      }

      // 충돌 검사
      if (this.checkCollision(item)) {
        this.handleItemCollection(item);
        this.items.splice(i, 1);
      }
    }
  }

  /**
   * 바구니 위치 업데이트
   */
  updateBasketPosition() {
    const zoneWidth = this.canvas.width / 3;
    let targetX = zoneWidth / 2; // Center

    if (this.currentPose === "Left") {
      targetX = zoneWidth / 2 - zoneWidth; // 화면 밖 방지 처리 필요
      targetX = zoneWidth * 0.5; // 1구역 중앙
    } else if (this.currentPose === "Right") {
      targetX = zoneWidth * 2.5; // 3구역 중앙
    } else {
      targetX = zoneWidth * 1.5; // 2구역 중앙
    }

    // 부드러운 이동 (선형 보간)
    this.basket.x += (targetX - this.basket.x) * 0.2;
    this.basket.y = this.canvas.height - 100; // 바닥에서 조금 위
  }

  /**
   * 아이템 생성
   */
  spawnItem() {
    const zones = ["Left", "Center", "Right"];
    const zoneWidth = this.canvas.width / 3;

    // 피버 모드: 랜덤 위치 OR 모든 위치 (여기선 랜덤으로 빠르게 생성하는 방식 채택)
    // 일반 모드: 랜덤 위치

    // 스폰 위치 결정
    // 피버 모드일 때는 한 번에 여러 개 떨어뜨릴 수도 있지만, 
    // 간격을 좁히는 것(200ms)이 더 '많이 떨어지는' 느낌을 줄 수 있음.
    // 여기서는 랜덤 위치 한 곳에 생성하되, 피버 시에는 무조건 과일만.

    const randomZone = zones[Math.floor(Math.random() * zones.length)];
    let x = zoneWidth * 1.5;
    if (randomZone === "Left") x = zoneWidth * 0.5;
    if (randomZone === "Right") x = zoneWidth * 2.5;

    // 아이템 타입 결정
    let type = "apple";
    let speedMult = 1;

    if (this.isFeverMode) {
      // 피버 모드: 무조건 과일 (점수 높은거 위주?)
      const rand = Math.random();
      if (rand < 0.4) type = "orange";
      else if (rand < 0.7) type = "grape";
      else type = "apple";

      speedMult = 1.5; // 피버 때는 조금 빠르게 떨어져도 재밌음
    } else {
      // 일반 모드
      const rand = Math.random();
      if (rand < 0.1) {
        type = "gift"; // 10% 확률 선물상자
      } else if (rand < 0.2) {
        type = "bomb"; // 10% 폭탄 (기존 20% -> 10%로 감소)
      } else if (rand < 0.5) {
        type = "grape";
      } else if (rand < 0.8) {
        type = "orange";
      } else {
        type = "apple";
      }
    }

    this.items.push({
      x: x,
      y: -50,
      type: type,
      speed: this.baseSpeed * (1 + (this.level * 0.1)) * speedMult
    });
  }

  /**
   * 충돌 감지
   */
  checkCollision(item) {
    // 간단한 거리 기반 충돌 (원형)
    const dist = Math.hypot(this.basket.x - item.x, this.basket.y - item.y);
    return dist < (this.basket.width / 2 + 20); // 20은 아이템 반경 대략값
  }

  /**
   * 아이템 획득 처리
   */
  handleItemCollection(item) {
    let scoreDelta = 0;

    switch (item.type) {
      case "apple": scoreDelta = 100; break;
      case "orange": scoreDelta = 200; break;
      case "grape": scoreDelta = 300; break;
      case "bomb": scoreDelta = -500; break;
      case "gift":
        scoreDelta = 0;
        this.activateFeverMode();
        break;
    }

    this.score += scoreDelta;
    if (this.score < 0) this.score = 0;

    // 레벨업 체크
    if (this.score >= this.level * 500) {
      this.level++;
      // 레벨업해도 너무 빨라지지 않게 조절
      if (!this.isFeverMode) {
        this.spawnInterval = Math.max(500, 2500 - (this.level * 200));
      }
    }

    if (this.onScoreChange) {
      this.onScoreChange(this.score, this.level);
    }
  }

  activateFeverMode() {
    this.isFeverMode = true;
    this.feverTimer = this.feverDuration;
    // 피버 모드 즉시 적용을 위해 spawnInterval은 update 루프에서 처리됨
  }

  /**
   * 렌더링
   */
  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // 화면 클리어
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 피버 모드 배경 효과 (선택)
    if (this.isFeverMode) {
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = "gold";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();
    }

    // 구역 표시 (선택 사항)
    const zoneWidth = this.canvas.width / 3;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.beginPath();
    ctx.moveTo(zoneWidth, 0);
    ctx.lineTo(zoneWidth, this.canvas.height);
    ctx.moveTo(zoneWidth * 2, 0);
    ctx.lineTo(zoneWidth * 2, this.canvas.height);
    ctx.stroke();

    // 바구니 그리기
    ctx.fillStyle = "#FFD700";
    ctx.font = "60px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🧺", this.basket.x, this.basket.y);

    // 아이템 그리기
    this.items.forEach(item => {
      let icon = "🍎";
      if (item.type === "orange") icon = "🍊";
      if (item.type === "grape") icon = "🍇";
      if (item.type === "bomb") icon = "💣";
      if (item.type === "gift") icon = "🎁";

      ctx.font = "50px sans-serif";
      ctx.fillText(icon, item.x, item.y);
    });
  }

  /**
   * 포즈 인식 결과 업데이트
   */
  onPoseDetected(detectedPose) {
    // 포즈 문자열 정규화 (소문자 처리 등 안전장치)
    // Left, Center, Right가 들어와야 함
    this.currentPose = detectedPose;
  }

  // Setters for callbacks
  setScoreChangeCallback(callback) { this.onScoreChange = callback; }
  setGameEndCallback(callback) { this.onGameEnd = callback; }
  setTimeUpdateCallback(callback) { this.onTimeUpdate = callback; }
}

window.GameEngine = GameEngine;
