export enum ActiveView {
  TUTOR = 'TUTOR',
  EXPLAINER = 'EXPLAINER',
  QUIZ = 'QUIZ',
  NEWS = 'NEWS',
  SUBJECTS = 'SUBJECTS',
  PLANNER = 'PLANNER',
  DASHBOARD = 'DASHBOARD',
  NOTES = 'NOTES',
  HELP = 'HELP',
  COMPETITION = 'COMPETITION',
  ADMIN = 'ADMIN',
}

export enum MessageSender {
  USER = 'USER',
  AI = 'AI',
}

export interface ChatMessage {
  sender: MessageSender;
  text: string;
}

export type ChatModel = 'gemini-2.5-flash' | 'gpt-4o' | 'gpt-3.5-turbo';

export interface ChatSession {
  id: string;
  name:string;
  messages: ChatMessage[];
  createdAt: number;
  model: ChatModel;
}

export type QuizDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface QuizConfig {
    topic: string;
    numQuestions: number;
    difficulty: QuizDifficulty;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}

export interface PlannerTask {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  notes?: string;
}

export interface StudyPlan {
  id: string;
  name: string;
  tasks: PlannerTask[];
  createdAt: number;
}

export type Theme = 'default' | 'solaris' | 'galaxy' | 'midnight' | 'crimson' | 'forest' | 'ivory';

export interface UserProfile {
  name: string;
  email: string;
  country: string;
  state?: string;
  district?: string;
}

export interface ApiKeys {
  openai: string;
  perplexity: string;
}

export interface CurrentAffairsQuery {
    date: string;
    keywords: string;
    region: string;
}

export interface CurrentAffairsSession {
    id: string;
    query: CurrentAffairsQuery;
    summary: string;
    sources: GroundingChunk[];
    timestamp: number;
}

export interface TopicExplainerConfig {
    depth: 'Beginner' | 'Intermediate' | 'Expert';
    format: 'Detailed Paragraphs' | 'Bullet Points' | 'Q&A Format';
    focus: string;
}

export interface TopicExplainerSession {
    id: string;
    topic: string;
    config: TopicExplainerConfig;
    explanation: string;
    timestamp: number;
}

export interface QuizResult {
    id: string;
    topicOrSubject: string;
    difficulty: QuizDifficulty;
    score: number;
    totalQuestions: number;
    timestamp: number;
    questions: QuizQuestion[];
    userAnswers: (number | null)[];
    userName?: string;
}