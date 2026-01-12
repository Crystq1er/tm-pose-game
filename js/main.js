/**
 * main.js
 * 애플리케이션 진입점 및 로직 연결
 */

let poseEngine, gameEngine;
let isInitialized = false;

// DOM Elements
const dom = {
  webcamContainer: document.getElementById('webcam-container'),
  gameCanvas: document.getElementById('game-canvas'),
  score: document.getElementById('score'),
  level: document.getElementById('level'),
  time: document.getElementById('time'),
  statusLabel: document.getElementById('status-label'),
  startBtn: document.getElementById('start-btn'),
  stopBtn: document.getElementById('stop-btn'),
  loading: document.getElementById('loading'),
  poseIndicators: {
    Left: document.querySelector('.pose-tag.left'),
    Center: document.querySelector('.pose-tag.center'),
    Right: document.querySelector('.pose-tag.right')
  }
};

/**
 * 초기화 Function
 */
async function init() {
  try {
    // 1. GameEngine 초기화
    gameEngine = new GameEngine();
    gameEngine.init(dom.gameCanvas);

    // UI 업데이트 콜백 연결
    gameEngine.setScoreChangeCallback((score, level) => {
      dom.score.innerText = score;
      dom.level.innerText = level;
    });

    gameEngine.setTimeUpdateCallback((time) => {
      dom.time.innerText = time;
    });

    gameEngine.setGameEndCallback((finalScore, finalLevel) => {
      alert(`🎉 게임 종료!\n최종 점수: ${finalScore}\n최종 레벨: ${finalLevel}`);
      dom.startBtn.style.display = 'inline-block';
      dom.stopBtn.style.display = 'none';
      dom.statusLabel.innerText = "게임 종료 (다시 하려면 Start 버튼)";
    });

    // 2. PoseEngine 초기화
    poseEngine = new PoseEngine("./my_model/");
    await poseEngine.init({ size: 200, flip: true });

    // 웹캠 캔버스 스타일 조정 (오버레이용)
    if (poseEngine.webcam.canvas) {
      dom.webcamContainer.appendChild(poseEngine.webcam.canvas);
    }

    // 예측 결과 처리
    poseEngine.setPredictionCallback((prediction, pose) => {
      if (!isInitialized) return;

      // 가장 높은 확률의 클래스 찾기
      let maxClass = "";
      let maxProb = 0;

      prediction.forEach(p => {
        if (p.probability > maxProb) {
          maxProb = p.probability;
          maxClass = p.className;
        }
      });

      if (maxProb > 0.8) { // 80% 이상 확신할 때만
        updatePoseUI(maxClass);
        if (gameEngine.isGameActive) {
          gameEngine.onPoseDetected(maxClass);
        }
      }
    });

    // 그리기 콜백 (스켈레톤 등) - 이번 게임에서는 게임 캔버스에 직접 그림으로 생략 가능
    // 하지만 디버깅용으로 남겨둘 수 있음

    poseEngine.start();
    isInitialized = true;

    // 로딩 제거
    dom.loading.classList.remove('active');
    dom.statusLabel.innerText = "준비 완료! Start 버튼을 누르세요.";
    dom.startBtn.disabled = false;

  } catch (err) {
    console.error(err);
    alert("초기화 실패 (카메라 권한을 확인하세요)");
    dom.loading.innerText = "오류 발생: " + err.message;
  }
}

/**
 * 포즈 UI 업데이트
 */
function updatePoseUI(currentClass) {
  // 모든 태그 비활성화
  Object.values(dom.poseIndicators).forEach(el => el && el.classList.remove('active'));

  // 현재 태그 활성화
  if (dom.poseIndicators[currentClass]) {
    dom.poseIndicators[currentClass].classList.add('active');
    dom.statusLabel.innerText = `현재 자세: ${currentClass}`;
  }
}

// 이벤트 리스너
dom.startBtn.addEventListener('click', () => {
  gameEngine.start();
  dom.startBtn.style.display = 'none';
  dom.stopBtn.style.display = 'inline-block';
  dom.statusLabel.innerText = "게임 중! 과일을 받으세요!";
});

dom.stopBtn.addEventListener('click', () => {
  gameEngine.stop();
  dom.startBtn.style.display = 'inline-block';
  dom.stopBtn.style.display = 'none';
  dom.statusLabel.innerText = "게임 중지됨";
});

// 실행
window.addEventListener('load', init);
