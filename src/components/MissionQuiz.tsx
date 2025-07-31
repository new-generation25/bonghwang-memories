'use client'

import { useState } from 'react'
import { Mission } from '@/lib/types'

interface MissionQuizProps {
  mission: Mission
  onComplete: (success: boolean, usedHint: boolean) => void
  onClose: () => void
}

export default function MissionQuiz({ mission, onComplete, onClose }: MissionQuizProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [showHint, setShowHint] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)

  if (!mission.quiz) return null

  const handleSubmit = () => {
    if (!selectedAnswer) return

    const correct = selectedAnswer === mission.quiz!.answer
    setIsCorrect(correct)
    setSubmitted(true)

    setTimeout(() => {
      onComplete(correct, showHint)
    }, 2000)
  }

  const handleShowHint = () => {
    setShowHint(true)
  }

  return (
    <div className="fixed inset-0 bg-vintage-paper z-50 flex flex-col" style={{ touchAction: 'none' }}>
      {/* Header */}
      <div className="bg-vintage-cream border-b-2 border-sepia-300 shadow-lg">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={onClose}
            className="flex items-center space-x-2 text-sepia-700 hover:text-sepia-900"
          >
            <span className="text-xl">←</span>
            <span className="font-handwriting">뒤로</span>
          </button>
          <h2 className="font-vintage text-lg text-vintage-brown">
            📝 퀴즈 미션
          </h2>
          <div className="w-16"></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-md mx-auto">
          {/* Story */}
          <div className="mb-6 bg-vintage-cream p-4 rounded-lg border-2 border-sepia-300">
            <h3 className="font-handwriting text-lg text-vintage-brown mb-2">
              아버지의 이야기
            </h3>
            <p className="font-handwriting text-base text-sepia-700 leading-relaxed">
              "{mission.story.intro}"
            </p>
          </div>

          {/* Quiz question */}
          <div className="mb-6">
            <h3 className="font-vintage text-xl text-vintage-brown mb-4 text-center">
              {mission.quiz.question}
            </h3>

            {/* Answer options */}
            <div className="space-y-3">
              {mission.quiz.options?.map((option, index) => (
                <button
                  key={index}
                  onClick={() => !submitted && setSelectedAnswer(option)}
                  disabled={submitted}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                    submitted
                      ? option === mission.quiz!.answer
                        ? 'bg-green-100 border-green-500 text-green-800'
                        : option === selectedAnswer && option !== mission.quiz!.answer
                        ? 'bg-red-100 border-red-500 text-red-800'
                        : 'bg-sepia-100 border-sepia-300 text-sepia-600'
                      : selectedAnswer === option
                      ? 'bg-vintage-brown text-white border-vintage-brown'
                      : 'bg-white border-sepia-300 text-sepia-700 hover:border-sepia-400 hover:bg-sepia-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      submitted
                        ? option === mission.quiz!.answer
                          ? 'border-green-500 bg-green-500'
                          : option === selectedAnswer && option !== mission.quiz!.answer
                          ? 'border-red-500 bg-red-500'
                          : 'border-gray-300'
                        : selectedAnswer === option
                        ? 'border-white bg-white'
                        : 'border-sepia-400'
                    }`}>
                      {submitted && option === mission.quiz!.answer && (
                        <span className="text-white text-sm">✓</span>
                      )}
                      {submitted && option === selectedAnswer && option !== mission.quiz!.answer && (
                        <span className="text-white text-sm">✗</span>
                      )}
                      {!submitted && selectedAnswer === option && (
                        <div className="w-2 h-2 bg-vintage-brown rounded-full"></div>
                      )}
                    </div>
                    <span className="font-handwriting text-lg">{option}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Hint section */}
          {!submitted && (
            <div className="mb-6">
              {!showHint ? (
                <button
                  onClick={handleShowHint}
                  className="w-full p-3 bg-sepia-100 border border-sepia-300 rounded-lg 
                           text-sepia-600 hover:bg-sepia-200 transition-colors duration-200"
                >
                  <span className="font-handwriting">💡 힌트 보기 (점수 -20점)</span>
                </button>
              ) : (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                  <h4 className="font-handwriting text-lg text-yellow-800 mb-2">
                    💡 힌트
                  </h4>
                  <p className="font-handwriting text-yellow-700">
                    1988년은 서울 올림픽이 열린 해입니다. 이 시기에 가장 인기 있었던 가수를 생각해보세요.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Submit button */}
          {!submitted && (
            <button
              onClick={handleSubmit}
              disabled={!selectedAnswer}
              className={`w-full vintage-button py-4 text-lg font-bold ${
                !selectedAnswer ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              정답 제출하기
            </button>
          )}

          {/* Result */}
          {submitted && (
            <div className={`text-center p-6 rounded-lg ${
              isCorrect ? 'bg-green-100 border-2 border-green-300' : 'bg-red-100 border-2 border-red-300'
            }`}>
              <div className="text-4xl mb-2">
                {isCorrect ? '🎉' : '😢'}
              </div>
              <h3 className="font-vintage text-xl mb-2 text-gray-800">
                {isCorrect ? '정답입니다!' : '틀렸습니다!'}
              </h3>
              <p className="font-handwriting text-gray-600 mb-4">
                {isCorrect 
                  ? `${showHint ? 80 : 100}점을 획득했습니다!`
                  : '다시 도전해보세요!'
                }
              </p>
              {isCorrect && (
                <div className="bg-white/80 p-3 rounded">
                  <p className="font-handwriting text-sm text-gray-700">
                    "{mission.story.outro}"
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}