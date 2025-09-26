import React, { useState, useEffect } from 'react';
import { supabase, SUPABASE_ENABLED } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../common/Card';
import { LoadingSpinner } from '../common/LoadingSpinner';
import MarkdownRenderer from '../common/MarkdownRenderer';

interface QuizMeta {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  start_at: string;
  end_at: string;
  duration_seconds: number;
  published_leaderboard: boolean;
  quiz_focus?: string | null;
  submitted_at?: string | null;
}

interface UserAttemptDetail {
  attempt_id: string;
  user_id: string;
  quiz_id: string;
  quiz_title: string;
  quiz_subject: string;
  question_id: string;
  question_text: string;
  user_options: any[];
  correct_index: number;
  user_chosen_index: number;
  is_correct: boolean;
  points_earned: number;
  question_order: number;
}

interface UserResultsViewProps {
  quiz: QuizMeta;
  onClose: () => void;
}

const UserResultsView: React.FC<UserResultsViewProps> = ({ quiz, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [attemptDetails, setAttemptDetails] = useState<UserAttemptDetail[]>([]);
  const [userAttempt, setUserAttempt] = useState<any>(null);

  useEffect(() => {
    const fetchUserResults = async () => {
      if (!user || !quiz.id) return;

      setLoading(true);
      try {
        // First get the user's attempt for this quiz
        const { data: attemptData, error: attemptError } = await supabase
          .from('competitive_quiz_attempts')
          .select('*')
          .eq('quiz_id', quiz.id)
          .eq('user_id', user.id)
          .single();

        if (attemptError || !attemptData) {
          console.error('Error fetching user attempt:', attemptError);
          setLoading(false);
          return;
        }

        setUserAttempt(attemptData);

        // Only fetch detailed results if leaderboard is published
        if (quiz.published_leaderboard) {
          const { data: detailsData, error: detailsError } = await supabase.rpc('admin_get_attempt_details', {
            p_attempt_id: attemptData.id
          });

          if (!detailsError && detailsData) {
            setAttemptDetails(detailsData as UserAttemptDetail[]);
          }
        }
      } catch (error) {
        console.error('Error fetching user results:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserResults();
  }, [user, quiz]);

  if (!quiz.published_leaderboard) {
    return (
      <Card>
        <div className="text-center py-8">
          <h3 className="text-lg font-semibold mb-2">Quiz Results</h3>
          <p className="text-[rgb(var(--color-text-secondary))]">
            Detailed results will be available once the leaderboard is published.
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 rounded-md bg-[rgb(var(--color-primary))] text-white hover:bg-[rgb(var(--color-primary-hover))]"
          >
            Close
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Your Results - {quiz.title}</h3>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md bg-[rgb(var(--color-input))] hover:bg-slate-600"
          >
            Close
          </button>
        </div>

        {userAttempt && (
          <div className="mb-6 p-4 rounded-lg bg-[rgb(var(--color-input))]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-[rgb(var(--color-primary))]">
                  {userAttempt.score}
                </div>
                <div className="text-sm text-[rgb(var(--color-text-secondary))]">
                  Final Score
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[rgb(var(--color-primary))]">
                  {userAttempt.accuracy ? userAttempt.accuracy.toFixed(1) : 0}%
                </div>
                <div className="text-sm text-[rgb(var(--color-text-secondary))]">
                  Accuracy
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[rgb(var(--color-primary))]">
                  {userAttempt.time_taken_seconds ? Math.floor(userAttempt.time_taken_seconds / 60) : 0}m
                </div>
                <div className="text-sm text-[rgb(var(--color-text-secondary))]">
                  Time Taken
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
            <span className="ml-2">Loading your results...</span>
          </div>
        ) : attemptDetails.length === 0 ? (
          <div className="text-center py-8 text-[rgb(var(--color-text-secondary))]">
            No detailed results available.
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="font-semibold text-base">Question-by-Question Breakdown:</h4>
            {attemptDetails.map((detail, detailIdx) => (
              <Card key={detail.question_id} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-2">
                  <div className="flex-1">
                    <div className="font-medium text-sm sm:text-base">
                      Question {detail.question_order + 1}
                    </div>
                    <div className="text-sm text-[rgb(var(--color-text-secondary))] mt-1">
                      {detail.question_text}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-1 text-xs rounded ${
                      detail.is_correct ? 'bg-green-900/30 text-green-200' : 'bg-red-900/30 text-red-200'
                    }`}>
                      {detail.is_correct ? '✓ Correct' : '✗ Incorrect'}
                    </div>
                    <div className="text-sm font-medium">
                      {detail.points_earned}/{detail.user_options[detail.correct_index]?.length ? 1 : 0} pts
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {detail.user_options.map((option, optIdx) => (
                    <div key={optIdx} className={`p-2 sm:p-3 rounded text-sm ${
                      optIdx === detail.correct_index
                        ? 'bg-green-900/20 border border-green-800/30'
                        : optIdx === detail.user_chosen_index
                        ? 'bg-red-900/20 border border-red-800/30'
                        : 'bg-[rgb(var(--color-input))]'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
                          optIdx === detail.correct_index
                            ? 'bg-green-600 text-white'
                            : optIdx === detail.user_chosen_index
                            ? 'bg-red-600 text-white'
                            : 'bg-[rgb(var(--color-border))]'
                        }`}>
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span className={`flex-1 ${optIdx === detail.correct_index ? 'text-green-200' : ''}`}>
                          {option}
                        </span>
                        {optIdx === detail.correct_index && (
                          <span className="text-xs text-green-300">✓ Correct Answer</span>
                        )}
                        {optIdx === detail.user_chosen_index && !detail.is_correct && (
                          <span className="text-xs text-red-300">Your Choice</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default UserResultsView;
