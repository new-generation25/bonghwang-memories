const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  // Basic CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  console.log('Request:', req.method, req.url);

  // Serve simple HTML for testing
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>봉황동 메모리즈: 아버지의 유산을 찾아서</title>
    <style>
        /* Inline Tailwind CSS for production use */
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Nanum Pen Script', cursive; }
        .min-h-screen { min-height: 100vh; }
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .items-center { align-items: center; }
        .justify-center { justify-content: center; }
        .text-center { text-align: center; }
        .space-y-4 > * + * { margin-top: 1rem; }
        .space-x-2 > * + * { margin-left: 0.5rem; }
        .space-x-4 > * + * { margin-left: 1rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mb-12 { margin-bottom: 3rem; }
        .mt-3 { margin-top: 0.75rem; }
        .mt-4 { margin-top: 1rem; }
        .mt-8 { margin-top: 2rem; }
        .p-2 { padding: 0.5rem; }
        .p-3 { padding: 0.75rem; }
        .p-4 { padding: 1rem; }
        .p-6 { padding: 1.5rem; }
        .p-8 { padding: 2rem; }
        .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
        .px-4 { padding-left: 1rem; padding-right: 1rem; }
        .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
        .px-8 { padding-left: 2rem; padding-right: 2rem; }
        .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
        .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
        .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
        .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
        .w-full { width: 100%; }
        .w-1/2 { width: 50%; }
        .w-3/4 { width: 75%; }
        .w-5/6 { width: 83.333333%; }
        .w-64 { width: 16rem; }
        .w-16 { width: 4rem; }
        .w-12 { width: 3rem; }
        .w-8 { width: 2rem; }
        .w-6 { width: 1.5rem; }
        .w-4 { width: 1rem; }
        .w-3 { width: 0.75rem; }
        .w-2 { width: 0.5rem; }
        .h-full { height: 100%; }
        .h-40 { height: 10rem; }
        .h-16 { height: 4rem; }
        .h-8 { height: 2rem; }
        .h-6 { height: 1.5rem; }
        .h-4 { height: 1rem; }
        .h-3 { height: 0.75rem; }
        .h-2 { height: 0.5rem; }
        .h-1 { height: 0.25rem; }
        .max-w-md { max-width: 28rem; }
        .max-w-sm { max-width: 24rem; }
        .max-w-lg { max-width: 32rem; }
        .rounded { border-radius: 0.25rem; }
        .rounded-lg { border-radius: 0.5rem; }
        .rounded-xl { border-radius: 0.75rem; }
        .rounded-full { border-radius: 9999px; }
        .border-2 { border-width: 2px; }
        .border-4 { border-width: 4px; }
        .border-t-4 { border-top-width: 4px; }
        .border-b-4 { border-bottom-width: 4px; }
        .border-l-4 { border-left-width: 4px; }
        .border-r-4 { border-right-width: 4px; }
        .border-t-2 { border-top-width: 2px; }
        .bg-white { background-color: #ffffff; }
        .bg-black { background-color: #000000; }
        .bg-blue-500 { background-color: #3b82f6; }
        .bg-blue-400 { background-color: #60a5fa; }
        .bg-blue-50 { background-color: #eff6ff; }
        .bg-green-100 { background-color: #dcfce7; }
        .bg-green-500 { background-color: #22c55e; }
        .bg-red-100 { background-color: #fee2e2; }
        .bg-red-500 { background-color: #ef4444; }
        .bg-gray-200 { background-color: #e5e7eb; }
        .text-white { color: #ffffff; }
        .text-black { color: #000000; }
        .text-blue-700 { color: #1d4ed8; }
        .text-green-800 { color: #166534; }
        .text-red-800 { color: #991b1b; }
        .text-sm { font-size: 1rem; line-height: 1.5rem; }
        .text-base { font-size: 1.2rem; line-height: 1.8rem; }
        .text-lg { font-size: 1.4rem; line-height: 2rem; }
        .text-xl { font-size: 1.6rem; line-height: 2.2rem; }
        .text-2xl { font-size: 1.8rem; line-height: 2.4rem; }
        .text-3xl { font-size: 2.2rem; line-height: 2.8rem; }
        .text-4xl { font-size: 2.8rem; line-height: 3.2rem; }
        .text-5xl { font-size: 3.6rem; line-height: 1.2; }
        .font-bold { font-weight: 700; }
        .leading-relaxed { line-height: 1.625; }
        .leading-tight { line-height: 1.25; }
        .border-amber-300 { border-color: #fcd34d; }
        .border-amber-400 { border-color: #fbbf24; }
        .border-amber-800 { border-color: #92400e; }
        .border-green-500 { border-color: #22c55e; }
        .border-red-500 { border-color: #ef4444; }
        .border-white { border-color: #ffffff; }
        .border-gray-300 { border-color: #d1d5db; }
        .bg-amber-50 { background-color: #fffbeb; }
        .bg-amber-100 { background-color: #fef3c7; }
        .bg-amber-200 { background-color: #fde68a; }
        .bg-amber-800 { background-color: #92400e; }
        .bg-amber-700 { background-color: #b45309; }
        .text-amber-600 { color: #d97706; }
        .text-amber-700 { color: #b45309; }
        .text-amber-800 { color: #92400e; }
        .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
        .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
        .hover\\:bg-amber-100:hover { background-color: #fef3c7; }
        .hover\\:bg-amber-200:hover { background-color: #fde68a; }
        .hover\\:bg-amber-300:hover { background-color: #fcd34d; }
        .hover\\:bg-amber-700:hover { background-color: #b45309; }
        .hover\\:text-amber-800:hover { color: #92400e; }
        .hover\\:text-amber-900:hover { color: #78350f; }
        .hover\\:text-gray-300:hover { color: #d1d5db; }
        .hover\\:scale-110:hover { transform: scale(1.1); }
        .transform { transform: translateX(0) translateY(0) rotate(0) skewX(0) skewY(0) scaleX(1) scaleY(1); }
        .rotate-1 { transform: rotate(1deg); }
        .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
        .transition-colors { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
        .duration-200 { transition-duration: 200ms; }
        .duration-300 { transition-duration: 300ms; }
        .animate-spin { animation: spin 1s linear infinite; }
        .animate-bounce { animation: bounce 1s infinite; }
        .animate-ping { animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite; }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .cursor-pointer { cursor: pointer; }
        .cursor-not-allowed { cursor: not-allowed; }
        .disabled\\:opacity-50:disabled { opacity: 0.5; }
        .disabled\\:cursor-not-allowed:disabled { cursor: not-allowed; }
        .opacity-50 { opacity: 0.5; }
        .opacity-75 { opacity: 0.75; }
        .opacity-80 { opacity: 0.8; }
        .backdrop-blur-sm { backdrop-filter: blur(4px); }
        .absolute { position: absolute; }
        .relative { position: relative; }
        .fixed { position: fixed; }
        .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
        .top-0 { top: 0; }
        .right-0 { right: 0; }
        .bottom-0 { bottom: 0; }
        .left-0 { left: 0; }
        .top-1\\/4 { top: 25%; }
        .top-1\\/2 { top: 50%; }
        .top-2\\/3 { top: 66.666667%; }
        .left-1\\/3 { left: 33.333333%; }
        .left-1\\/2 { left: 50%; }
        .left-1\\/4 { left: 25%; }
        .right-4 { right: 1rem; }
        .top-4 { top: 1rem; }
        .bottom-4 { bottom: 1rem; }
        .left-4 { left: 1rem; }
        .-top-1 { top: -0.25rem; }
        .-right-1 { right: -0.25rem; }
        .-top-2 { top: -0.5rem; }
        .-right-2 { right: -0.5rem; }
        .z-50 { z-index: 50; }
        .grid { display: grid; }
        .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .grid-cols-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
        .gap-2 { gap: 0.5rem; }
        .gap-4 { gap: 1rem; }
        .overflow-hidden { overflow: hidden; }
        .overflow-y-auto { overflow-y: auto; }
        .bg-gradient-to-br { background-image: linear-gradient(to bottom right, var(--tw-gradient-stops)); }
        .from-amber-100 { --tw-gradient-from: #fef3c7; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(254, 243, 199, 0)); }
        .to-amber-200 { --tw-gradient-to: #fde68a; }
        
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        @keyframes bounce {
            0%, 100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
            50% { transform: translateY(0); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
        }
        @keyframes ping {
            75%, 100% { transform: scale(2); opacity: 0; }
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: .5; }
        }
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Nanum Pen Script', cursive; }
        .vintage-button {
            background: linear-gradient(to right, #8B4513, #A67C5A);
            color: white;
            font-weight: bold;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            transition: all 0.3s;
            border: none;
            cursor: pointer;
        }
        .vintage-button:hover {
            transform: scale(1.05);
            box-shadow: 0 8px 16px rgba(0,0,0,0.4);
        }
        .vintage-paper {
            background-color: #f4f1e8;
            background-image: radial-gradient(circle at 25px 25px, #e8d5b7 2px, transparent 2px);
            background-size: 50px 50px;
        }
    </style>
</head>
<body class="vintage-paper min-h-screen">
    <div class="min-h-screen flex flex-col items-center justify-center p-6">
        <!-- Main content -->
        <div class="max-w-md w-full text-center">
            <!-- Title -->
            <div class="mb-12">
                <h1 class="text-5xl font-bold text-amber-800 mb-4" style="font-family: 'Playfair Display', serif;">
                    봉황동 메모리즈
                </h1>
                <p class="text-2xl text-amber-700">
                    아버지의 유산을 찾아서
                </p>
            </div>

            <!-- Illustration -->
            <div class="mb-12">
                <div class="relative mx-auto w-64 h-40 bg-amber-50 border-2 border-amber-400 shadow-lg transform rotate-1 rounded">
                    <div class="absolute top-4 left-4 right-4 bottom-4 p-2">
                        <div class="w-full h-2 bg-amber-300 mb-2 rounded"></div>
                        <div class="w-3/4 h-2 bg-amber-300 mb-2 rounded"></div>
                        <div class="w-5/6 h-2 bg-amber-300 mb-2 rounded"></div>
                        <div class="w-1/2 h-2 bg-amber-300 rounded"></div>
                    </div>
                    <div class="absolute -top-2 -right-2 w-8 h-6 bg-amber-800 rounded shadow-lg"></div>
                </div>
            </div>

            <!-- Buttons -->
            <div class="space-y-4">
                <button onclick="startJourney()" class="vintage-button text-lg w-full">
                    아버지의 유산 찾기
                </button>
                
                <div class="text-sm text-amber-600">
                    📱 모바일에서 최적화되어 있습니다
                </div>
            </div>

            <!-- Demo info -->
            <div class="mt-8 p-4 bg-white/80 rounded-lg">
                <h3 class="font-bold text-amber-800 mb-2">🎮 체험 가능한 기능</h3>
                <ul class="text-sm text-amber-700 space-y-1">
                    <li>📜 인터랙티브 스토리텔링</li>
                    <li>🗺️ 빈티지 스타일 지도</li>
                    <li>📸 카메라 미션 (모바일에서)</li>
                    <li>🧩 퀴즈 시스템</li>
                    <li>📍 GPS 위치 인증</li>
                    <li>💎 보물 빙고판</li>
                </ul>
            </div>
        </div>
    </div>

    <script>
        function startJourney() {
            // PC Testing Mode - Skip all permission requests
            showStory();
        }

        function showStory() {
            document.body.innerHTML = \`
                <div class="vintage-paper min-h-screen flex flex-col items-center justify-center p-6">
                    <div class="max-w-lg w-full">
                        <div class="bg-amber-50 border-2 border-amber-300 shadow-2xl p-8 transform rotate-1 rounded min-h-[500px]">
                            <div id="story-content" class="space-y-4">
                                <div class="typing-text">나의 소중한 아이야,</div>
                            </div>
                            <div class="mt-8 text-center">
                                <button onclick="skipStory()" class="text-amber-600 hover:text-amber-800 text-sm">
                                    SKIP →
                                </button>
                            </div>
                        </div>
                        <div id="start-button" class="mt-8 text-center" style="display: none;">
                            <button onclick="showExploration()" class="vintage-button text-xl py-4 px-8">
                                탐험 시작하기
                            </button>
                        </div>
                    </div>
                </div>
            \`;

            // Simulate typing effect
            const storyLines = [
                "나의 소중한 아이야,",
                "",
                "이 편지를 읽고 있다면, 아빠는 이미 그곳에 있을 거야.",
                "",
                "상자 안에 있는 낡은 필름 카메라를 보렴.",
                "그리고 빛바랜 사진 한 장...",
                "",
                "나의 가장 소중한 보물을 찾고 싶다면,",
                "이 사진 속 장소에서부터 여행을 시작하렴.",
                "",
                "봉황동 곳곳에 숨겨둔 나의 기억들을 따라가다 보면,",
                "네가 진짜 보물이 무엇인지 알게 될 거야.",
                "",
                "사랑하는 아빠가"
            ];

            let currentLine = 0;
            const storyContent = document.getElementById('story-content');
            
            function addNextLine() {
                if (currentLine < storyLines.length) {
                    const div = document.createElement('div');
                    div.className = 'typing-text';
                    div.textContent = storyLines[currentLine];
                    if (storyLines[currentLine] === "") {
                        div.innerHTML = '<div class="h-4"></div>';
                    }
                    const storyContentElement = document.getElementById('story-content');
                    if (storyContentElement) {
                        storyContentElement.appendChild(div);
                    }
                    currentLine++;
                    setTimeout(addNextLine, 1500);
                } else {
                    const startButton = document.getElementById('start-button');
                    if (startButton) {
                        startButton.style.display = 'block';
                    }
                }
            }

            setTimeout(addNextLine, 1500);
        }

        function skipStory() {
            const startButton = document.getElementById('start-button');
            if (startButton) {
                startButton.style.display = 'block';
            }
        }

        function showExploration() {
            document.body.innerHTML = \`
                <div class="vintage-paper min-h-screen pb-32">
                    <!-- Header -->
                    <div class="bg-amber-50 border-b-2 border-amber-300 shadow-lg">
                        <div class="max-w-md mx-auto px-4 py-4">
                            <h1 class="text-lg text-amber-800 text-center font-bold">
                                아버지의 첫 번째 기억을 찾아서
                            </h1>
                            <div class="mt-3 flex items-center justify-center space-x-2">
                                <div class="w-3 h-3 rounded-full bg-white border-2 border-amber-800 animate-pulse"></div>
                                <div class="w-3 h-3 rounded-full bg-amber-200 border-2 border-amber-300"></div>
                                <div class="w-3 h-3 rounded-full bg-amber-200 border-2 border-amber-300"></div>
                                <div class="w-3 h-3 rounded-full bg-amber-200 border-2 border-amber-300"></div>
                                <div class="w-3 h-3 rounded-full bg-amber-200 border-2 border-amber-300"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Map -->
                    <div class="max-w-md mx-auto px-4 py-6">
                        <div class="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
                            <div class="relative w-full h-96 bg-gradient-to-br from-amber-100 to-amber-200 rounded-lg">
                                <!-- Mission markers -->
                                <button onclick="selectMission(1)" class="absolute top-1/4 left-1/3 w-12 h-12 bg-amber-800 hover:bg-amber-700 rounded-full shadow-lg border-2 border-white flex items-center justify-center transform hover:scale-110 transition-all">
                                    <span class="text-white font-bold">1</span>
                                    <div class="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>
                                </button>
                                
                                <button onclick="selectMission(2)" class="absolute top-2/3 left-1/2 w-12 h-12 bg-amber-800 hover:bg-amber-700 rounded-full shadow-lg border-2 border-white flex items-center justify-center transform hover:scale-110 transition-all">
                                    <span class="text-white font-bold">2</span>
                                </button>
                                
                                <button onclick="selectMission(3)" class="absolute top-1/2 left-1/4 w-12 h-12 bg-amber-800 hover:bg-amber-700 rounded-full shadow-lg border-2 border-white flex items-center justify-center transform hover:scale-110 transition-all">
                                    <span class="text-white font-bold">3</span>
                                </button>

                                <!-- User location -->
                                <div class="absolute top-1/2 left-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg">
                                    <div class="absolute inset-0 w-4 h-4 bg-blue-400 rounded-full animate-ping opacity-75"></div>
                                </div>

                                <!-- Legend -->
                                <div class="absolute bottom-4 left-4 bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow-lg">
                                    <div class="flex items-center space-x-4 text-sm">
                                        <div class="flex items-center space-x-2">
                                            <div class="w-4 h-4 bg-amber-800 rounded-full"></div>
                                            <span class="text-amber-700">미션</span>
                                        </div>
                                        <div class="flex items-center space-x-2">
                                            <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
                                            <span class="text-amber-700">현재 위치</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Stats -->
                        <div class="bg-amber-50 rounded-lg p-4 shadow-lg">
                            <h3 class="text-lg text-amber-800 mb-3 text-center font-bold">탐험 현황</h3>
                            <div class="grid grid-cols-2 gap-4 text-center">
                                <div>
                                    <div class="text-2xl font-bold text-yellow-600">0</div>
                                    <div class="text-sm text-amber-600">완료한 기억</div>
                                </div>
                                <div>
                                    <div class="text-2xl font-bold text-amber-700">5</div>
                                    <div class="text-sm text-amber-600">남은 기억</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Navigation -->
                    <div class="fixed bottom-0 left-0 right-0 bg-amber-50 border-t-2 border-amber-300 shadow-lg">
                        <div class="flex items-center justify-around py-2 px-4 max-w-md mx-auto">
                            <button onclick="alert('스토리로 돌아가기')" class="flex flex-col items-center py-2 px-3 rounded-lg text-amber-700 hover:bg-amber-100">
                                <span class="text-xl mb-1">📜</span>
                                <span class="text-xs font-bold">스토리</span>
                            </button>
                            <button class="flex flex-col items-center py-2 px-3 rounded-lg bg-amber-800 text-white shadow-md">
                                <span class="text-xl mb-1">🗺️</span>
                                <span class="text-xs font-bold">탐험</span>
                            </button>
                            <button onclick="showTreasure()" class="flex flex-col items-center py-2 px-3 rounded-lg text-amber-700 hover:bg-amber-100">
                                <span class="text-xl mb-1">💎</span>
                                <span class="text-xs font-bold">보물</span>
                            </button>
                            <button onclick="showCommunity()" class="flex flex-col items-center py-2 px-3 rounded-lg text-amber-700 hover:bg-amber-100">
                                <span class="text-xl mb-1">👥</span>
                                <span class="text-xs font-bold">커뮤니티</span>
                            </button>
                        </div>
                    </div>
                </div>
            \`;
        }

        function selectMission(missionNum) {
            const missions = {
                1: {
                    title: "첫 번째 기억: 달콤한 우유 한 잔의 추억",
                    story: "세상의 때를 함께 씻어내던 그곳, 목욕 후 마셨던 시원한 우유 한 잔의 달콤함을 기억하니? 그 우유는 유난히 노란색이었지.",
                    type: "📸 사진 촬영"
                },
                2: {
                    title: "두 번째 기억: 마을의 이야기가 흐르던 우물",
                    story: "마을의 모든 소식이 모이던 곳. 그곳에서 길어 올린 건 차가운 물만이 아니었단다. 귀 기울이면 지금도 그 시절의 소리가 들릴지 몰라.",
                    type: "📱 QR 스캔"
                },
                3: {
                    title: "세 번째 기억: 낡은 LP판의 선율",
                    story: "네가 태어나던 해, 아빠는 이곳에서 네 엄마에게 줄 LP판을 샀단다. 먼지가 쌓인 선율 속에도 우리의 시간이 담겨있지.",
                    type: "🧩 퀴즈"
                }
            };

            const mission = missions[missionNum];
            if (mission) {
                const modal = \`
                    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div class="bg-amber-50 border-2 border-amber-400 rounded-lg shadow-2xl max-w-md w-full">
                            <div class="p-6 border-b border-amber-300">
                                <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                                        class="absolute top-4 right-4 w-8 h-8 rounded-full bg-amber-200 hover:bg-amber-300 flex items-center justify-center">
                                    <span class="text-amber-700 font-bold">×</span>
                                </button>
                                <h2 class="text-xl text-amber-800 mb-2 pr-8 font-bold">\${mission.title}</h2>
                                <span class="text-sm bg-amber-200 text-amber-700 px-3 py-1 rounded-full">\${mission.type}</span>
                            </div>
                            <div class="p-6">
                                <div class="mb-6">
                                    <h3 class="text-lg text-amber-800 mb-3 font-bold">아버지의 편지</h3>
                                    <div class="bg-white/80 p-4 rounded-lg border border-amber-200">
                                        <p class="text-base text-amber-700 leading-relaxed">"\${mission.story}"</p>
                                    </div>
                                </div>
                                <div class="text-center">
                                    <button onclick="startMission(\${missionNum})" class="vintage-button w-full py-3 text-lg">
                                        미션 시작하기
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                \`;
                document.body.insertAdjacentHTML('beforeend', modal);
            }
        }

        function startMission(missionNum) {
            if (missionNum === 1) {
                alert('📸 사진 촬영 미션입니다! 실제 앱에서는 카메라가 실행됩니다.');
            } else if (missionNum === 2) {
                alert('📱 QR 스캔 미션입니다! 실제 앱에서는 QR 스캐너가 실행됩니다.');
            } else if (missionNum === 3) {
                showQuiz();
            }
        }

        function showQuiz() {
            document.querySelector('.fixed').remove();
            const quiz = \`
                <div class="fixed inset-0 bg-amber-50 z-50 overflow-y-auto">
                    <div class="bg-amber-50 border-b-2 border-amber-300 shadow-lg">
                        <div class="flex items-center justify-between p-4">
                            <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                                    class="flex items-center space-x-2 text-amber-700 hover:text-amber-900">
                                <span class="text-xl">←</span>
                                <span>뒤로</span>
                            </button>
                            <h2 class="text-lg text-amber-800 font-bold">🧩 퀴즈 미션</h2>
                            <div class="w-16"></div>
                        </div>
                    </div>
                    
                    <div class="p-6">
                        <div class="max-w-md mx-auto">
                            <div class="mb-6 bg-white p-4 rounded-lg border-2 border-amber-300">
                                <h3 class="text-lg text-amber-800 mb-2 font-bold">아버지의 이야기</h3>
                                <p class="text-base text-amber-700 leading-relaxed">
                                    "네가 태어나던 해, 아빠는 이곳에서 네 엄마에게 줄 LP판을 샀단다. 먼지가 쌓인 선율 속에도 우리의 시간이 담겨있지."
                                </p>
                            </div>

                            <div class="mb-6">
                                <h3 class="text-xl text-amber-800 mb-4 text-center font-bold">
                                    1988년에 가장 유행했던 가수는?
                                </h3>

                                <div class="space-y-3">
                                    <button onclick="selectAnswer(this, '조용필', true)" 
                                            class="w-full p-4 rounded-lg border-2 border-amber-300 bg-white text-amber-700 hover:border-amber-400 hover:bg-amber-50 text-left">
                                        <div class="flex items-center space-x-3">
                                            <div class="w-6 h-6 rounded-full border-2 border-amber-400"></div>
                                            <span class="text-lg">조용필</span>
                                        </div>
                                    </button>
                                    
                                    <button onclick="selectAnswer(this, '이문세', false)" 
                                            class="w-full p-4 rounded-lg border-2 border-amber-300 bg-white text-amber-700 hover:border-amber-400 hover:bg-amber-50 text-left">
                                        <div class="flex items-center space-x-3">
                                            <div class="w-6 h-6 rounded-full border-2 border-amber-400"></div>
                                            <span class="text-lg">이문세</span>
                                        </div>
                                    </button>
                                    
                                    <button onclick="selectAnswer(this, '변진섭', false)" 
                                            class="w-full p-4 rounded-lg border-2 border-amber-300 bg-white text-amber-700 hover:border-amber-400 hover:bg-amber-50 text-left">
                                        <div class="flex items-center space-x-3">
                                            <div class="w-6 h-6 rounded-full border-2 border-amber-400"></div>
                                            <span class="text-lg">변진섭</span>
                                        </div>
                                    </button>
                                    
                                    <button onclick="selectAnswer(this, '신승훈', false)" 
                                            class="w-full p-4 rounded-lg border-2 border-amber-300 bg-white text-amber-700 hover:border-amber-400 hover:bg-amber-50 text-left">
                                        <div class="flex items-center space-x-3">
                                            <div class="w-6 h-6 rounded-full border-2 border-amber-400"></div>
                                            <span class="text-lg">신승훈</span>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            \`;
            document.body.insertAdjacentHTML('beforeend', quiz);
        }

        function selectAnswer(button, answer, isCorrect) {
            // Disable all buttons
            const buttons = button.parentElement.querySelectorAll('button');
            buttons.forEach(btn => btn.disabled = true);

            // Show result
            const circle = button.querySelector('.w-6');
            if (isCorrect) {
                button.classList.add('bg-green-100', 'border-green-500');
                button.classList.remove('bg-white', 'border-amber-300');
                circle.classList.add('bg-green-500', 'border-green-500');
                circle.innerHTML = '<span class="text-white text-sm">✓</span>';
                
                setTimeout(() => {
                    alert('🎉 정답입니다! 100점을 획득했습니다!');
                    document.querySelector('.fixed').remove();
                }, 1000);
            } else {
                button.classList.add('bg-red-100', 'border-red-500');
                button.classList.remove('bg-white', 'border-amber-300');
                circle.classList.add('bg-red-500', 'border-red-500');
                circle.innerHTML = '<span class="text-white text-sm">✗</span>';
                
                setTimeout(() => {
                    alert('😢 틀렸습니다! 다시 도전해보세요!');
                }, 1000);
            }
        }

        function showCommunity() {
            document.body.innerHTML = \`
                <div class="vintage-paper min-h-screen pb-32">
                    <!-- Header -->
                    <div class="bg-amber-50 border-b-2 border-amber-300 shadow-lg">
                        <div class="max-w-md mx-auto px-4 py-4">
                            <h1 class="text-lg text-amber-800 text-center font-bold mb-4">
                                👥 커뮤니티
                            </h1>
                            
                            <!-- Tab navigation -->
                            <div class="flex bg-amber-100 rounded-lg p-1">
                                <button onclick="showMemoriesTab()" class="flex-1 py-2 px-4 rounded-md text-base bg-amber-800 text-white shadow-md">
                                    📸 우리들의 추억
                                </button>
                                <button onclick="showRankingTab()" class="flex-1 py-2 px-4 rounded-md text-base text-amber-700 hover:bg-amber-200">
                                    🏆 명예의 전당
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Content -->
                    <div id="community-content" class="max-w-md mx-auto px-4 py-6">
                        <!-- Memories Tab Content -->
                        <div id="memories-content">
                            <!-- Post instruction -->
                            <div class="bg-amber-50 rounded-lg p-4 mb-6 border-2 border-amber-300">
                                <h3 class="text-lg text-amber-800 mb-2 font-bold">📝 방명록 작성하기</h3>
                                <p class="text-base text-amber-700 mb-3">미션을 완료하면 자동으로 추억이 공유됩니다!</p>
                                <button onclick="showExploration()" class="w-full py-2 bg-amber-200 text-amber-700 rounded-lg hover:bg-amber-300 transition-colors duration-200">
                                    🗺️ 미션하러 가기
                                </button>
                            </div>

                            <!-- Posts -->
                            <div class="space-y-6">
                                <!-- Post 1 -->
                                <div class="bg-white p-4 shadow-lg rounded cursor-pointer hover:shadow-xl transition-all duration-300 transform rotate-1 hover:scale-105">
                                    <div class="w-full h-40 bg-amber-200 rounded mb-3 flex items-center justify-center">
                                        <div class="text-amber-600 text-center">
                                            <div class="text-4xl mb-2">📸</div>
                                            <div class="text-sm">미션 사진</div>
                                        </div>
                                    </div>
                                    
                                    <div class="space-y-2">
                                        <div class="flex items-center justify-between">
                                            <span class="text-base font-bold text-amber-800">민수아빠</span>
                                            <span class="text-xs text-amber-600">2시간 전</span>
                                        </div>
                                        
                                        <div class="text-xs bg-amber-100 px-2 py-1 rounded text-amber-600">
                                            첫 번째 기억: 달콤한 우유
                                        </div>
                                        
                                        <p class="text-sm text-amber-700">
                                            아이와 함께 찾은 추억의 장소! 바나나맛 우유의 달콤함이 그대로 느껴지네요 🥛
                                        </p>
                                        
                                        <div class="flex items-center justify-between pt-2">
                                            <button class="flex items-center space-x-1 text-red-500 hover:text-red-600">
                                                <span>❤️</span>
                                                <span class="text-sm">12</span>
                                            </button>
                                            <div class="text-xs text-amber-500">💬 댓글 3</div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Post 2 -->
                                <div class="bg-white p-4 shadow-lg rounded cursor-pointer hover:shadow-xl transition-all duration-300 transform -rotate-1 hover:scale-105">
                                    <div class="w-full h-40 bg-amber-200 rounded mb-3 flex items-center justify-center">
                                        <div class="text-amber-600 text-center">
                                            <div class="text-4xl mb-2">📸</div>
                                            <div class="text-sm">미션 사진</div>
                                        </div>
                                    </div>
                                    
                                    <div class="space-y-2">
                                        <div class="flex items-center justify-between">
                                            <span class="text-base font-bold text-amber-800">봉황동토박이</span>
                                            <span class="text-xs text-amber-600">5시간 전</span>
                                        </div>
                                        
                                        <div class="text-xs bg-amber-100 px-2 py-1 rounded text-amber-600">
                                            세 번째 기억: 낡은 LP판
                                        </div>
                                        
                                        <p class="text-sm text-amber-700">
                                            조용필의 "돌아와요 부산항에"가 흘러나오던 그 시절... 정말 감동적이었어요 🎵
                                        </p>
                                        
                                        <div class="flex items-center justify-between pt-2">
                                            <button class="flex items-center space-x-1 text-red-500 hover:text-red-600">
                                                <span>❤️</span>
                                                <span class="text-sm">8</span>
                                            </button>
                                            <div class="text-xs text-amber-500">💬 댓글 1</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Navigation -->
                    <div class="fixed bottom-0 left-0 right-0 bg-amber-50 border-t-2 border-amber-300 shadow-lg">
                        <div class="flex items-center justify-around py-2 px-4 max-w-md mx-auto">
                            <button onclick="alert('스토리로 돌아가기')" class="flex flex-col items-center py-2 px-3 rounded-lg text-amber-700 hover:bg-amber-100">
                                <span class="text-xl mb-1">📜</span>
                                <span class="text-xs font-bold">스토리</span>
                            </button>
                            <button onclick="showExploration()" class="flex flex-col items-center py-2 px-3 rounded-lg text-amber-700 hover:bg-amber-100">
                                <span class="text-xl mb-1">🗺️</span>
                                <span class="text-xs font-bold">탐험</span>
                            </button>
                            <button onclick="showTreasure()" class="flex flex-col items-center py-2 px-3 rounded-lg text-amber-700 hover:bg-amber-100">
                                <span class="text-xl mb-1">💎</span>
                                <span class="text-xs font-bold">보물</span>
                            </button>
                            <button class="flex flex-col items-center py-2 px-3 rounded-lg bg-amber-800 text-white shadow-md">
                                <span class="text-xl mb-1">👥</span>
                                <span class="text-xs font-bold">커뮤니티</span>
                            </button>
                        </div>
                    </div>
                </div>
            \`;
        }

        function showMemoriesTab() {
            // Update tab buttons
            const tabButtons = document.querySelectorAll('.flex-1');
            tabButtons[0].className = 'flex-1 py-2 px-4 rounded-md text-base bg-amber-800 text-white shadow-md';
            tabButtons[1].className = 'flex-1 py-2 px-4 rounded-md text-base text-amber-700 hover:bg-amber-200';
            
            // Show memories content (already visible)
        }

        function showRankingTab() {
            // Update tab buttons
            const tabButtons = document.querySelectorAll('.flex-1');
            tabButtons[0].className = 'flex-1 py-2 px-4 rounded-md text-base text-amber-700 hover:bg-amber-200';
            tabButtons[1].className = 'flex-1 py-2 px-4 rounded-md text-base bg-amber-800 text-white shadow-md';
            
            // Update content
            document.getElementById('community-content').innerHTML = \`
                <!-- My rank -->
                <div class="bg-amber-50 rounded-lg p-4 mb-6 border-2 border-yellow-400">
                    <h3 class="text-lg text-amber-800 mb-3 text-center font-bold">📊 나의 순위</h3>
                    <div class="bg-white rounded-lg p-4 text-center">
                        <div class="text-3xl font-bold text-yellow-600">
                            #42
                        </div>
                        <div class="text-base text-amber-700 mb-2">
                            점수: 150점
                        </div>
                        <div class="text-sm text-amber-600">
                            상위 25%
                        </div>
                    </div>
                </div>

                <!-- Top 10 ranking -->
                <div class="bg-amber-50 rounded-lg p-4 border-2 border-amber-300">
                    <h3 class="text-lg text-amber-800 mb-4 text-center font-bold">🏆 TOP 10 랭킹</h3>
                    
                    <div class="space-y-3">
                        <div class="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-yellow-200 to-yellow-100 border border-yellow-400">
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 rounded-full bg-yellow-400 text-yellow-900 flex items-center justify-center font-bold">1</div>
                                <div class="text-base font-bold text-amber-800">👑 봉황동마스터</div>
                            </div>
                            <div class="text-base font-bold text-yellow-600">1,250점</div>
                        </div>
                        
                        <div class="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-gray-200 to-gray-100 border border-gray-300">
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center font-bold">2</div>
                                <div class="text-base font-bold text-amber-800">🥈 메모리헌터</div>
                            </div>
                            <div class="text-base font-bold text-yellow-600">1,180점</div>
                        </div>
                        
                        <div class="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-orange-200 to-orange-100 border border-orange-400">
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 rounded-full bg-orange-400 text-orange-900 flex items-center justify-center font-bold">3</div>
                                <div class="text-base font-bold text-amber-800">🥉 문화탐험가</div>
                            </div>
                            <div class="text-base font-bold text-yellow-600">1,050점</div>
                        </div>
                        
                        <div class="flex items-center justify-between p-3 rounded-lg bg-white border border-amber-200">
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center font-bold">4</div>
                                <div class="text-base font-bold text-amber-800">🏆 역사학자</div>
                            </div>
                            <div class="text-base font-bold text-yellow-600">920점</div>
                        </div>
                        
                        <div class="flex items-center justify-between p-3 rounded-lg bg-white border border-amber-200">
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center font-bold">5</div>
                                <div class="text-base font-bold text-amber-800">⭐ 가족여행러</div>
                            </div>
                            <div class="text-base font-bold text-yellow-600">850점</div>
                        </div>
                    </div>
                </div>

                <!-- Ranking info -->
                <div class="mt-6 bg-blue-50 border border-blue-300 rounded-lg p-4">
                    <h4 class="text-base text-blue-800 mb-2 font-bold">💡 점수 획득 방법</h4>
                    <div class="text-sm text-blue-700 space-y-1">
                        <div>• 메인 미션 완료: 100점</div>
                        <div>• 서브 미션 완료: 30점</div>
                        <div>• 빙고 달성: 50점/줄</div>
                        <div>• 방명록 작성: 10점</div>
                        <div>• 좋아요 받기: 1점</div>
                    </div>
                </div>
            \`;
        }
    </script>
</body>
</html>
    `);
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Page not found');
});

const PORT = 3002;
server.listen(PORT, () => {
  console.log(`🚀 봉황동 메모리즈 서버가 실행중입니다!`);
  console.log(`📱 브라우저에서 http://localhost:${PORT} 로 접속하세요`);
  console.log(`💡 모바일에서 접속하면 모든 기능을 체험할 수 있습니다!`);
});