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
    <div className="fixed inset-0 bg-cream-base z-50 flex flex-col" style={{ touchAction: 'none' }}>
      {/* Header */}
      <div className="bg-cream border-b-2 border-line shadow-lg">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={onClose}
            className="flex items-center space-x-2 text-ink hover:text-ink"
          >
            <span className="text-xl">←</span>
            <span className="font-handwriting">뒤로</span>
          </button>
          <h2 className="font-vintage text-lg text-teal-dk">
            📝 퀴즈 미션
          </h2>
          <div className="w-16"></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-md mx-auto">
          {/* Story */}
          <div className="mb-6 bg-cream p-4 rounded-lg border-2 border-line">
            <h3 className="font-handwriting text-lg text-teal-dk mb-2">
              아버지의 이야기
            </h3>
            <p className="font-handwriting text-base text-ink leading-relaxed">
              "{mission.story.intro}"
            </p>
          </div>

          {/* Quiz question */}
          <div className="mb-6">
            <h3 className="font-vintage text-xl text-teal-dk mb-4 text-center">
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
                        ? 'bg-teal/15 border-teal text-teal-dk'
                        : option === selectedAnswer && option !== mission.quiz!.answer
                        ? 'bg-rec/15 border-rec text-rec'
                        : 'bg-cream border-line text-ink-60'
                      : selectedAnswer === option
                      ? 'bg-teal text-white border-teal'
                      : 'bg-white border-line text-ink hover:border-line hover:bg-paper'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      submitted
                        ? option === mission.quiz!.answer
                          ? 'border-teal bg-teal/100'
                          : option === selectedAnswer && option !== mission.quiz!.answer
                          ? 'border-rec bg-rec/100'
                          : 'border-line'
                        : selectedAnswer === option
                        ? 'border-white bg-white'
                        : 'border-line'
                    }`}>
                      {submitted && option === mission.quiz!.answer && (
                        <span className="text-white text-sm">✓</span>
                      )}
                      {submitted && option === selectedAnswer && option !== mission.quiz!.answer && (
                        <span className="text-white text-sm">✗</span>
                      )}
                      {!submitted && selectedAnswer === option && (
                        <div className="w-2 h-2 bg-teal rounded-full"></div>
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
                  className="w-full p-3 bg-cream border border-line rounded-lg 
                           text-ink-60 hover:bg-cream-dp transition-colors duration-200"
                >
                  <span className="font-handwriting">💡 힌트 보기 (점수 -20점)</span>
                </button>
              ) : (
                <div className="bg-sunset/15 border border-sunset rounded-lg p-4">
                  <h4 className="font-handwriting text-lg text-shell mb-2">
                    💡 힌트
                  </h4>
                  <p className="font-handwriting text-shell">
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
              isCorrect ? 'bg-teal/15 border-2 border-teal' : 'bg-rec/15 border-2 border-rec'
            }`}>
              <div className="text-4xl mb-2">
                {isCorrect ? '🎉' : '😢'}
              </div>
              <h3 className="font-vintage text-xl mb-2 text-ink">
                {isCorrect ? '정답입니다!' : '틀렸습니다!'}
              </h3>
              <p className="font-handwriting text-ink-60 mb-4">
                {isCorrect 
                  ? `${showHint ? 80 : 100}점을 획득했습니다!`
                  : '다시 도전해보세요!'
                }
              </p>
              {isCorrect && (
                <div className="bg-white/80 p-3 rounded">
                  <p className="font-handwriting text-sm text-ink">
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