import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlannerTask, StudyPlan } from '../../types';
import Card from '../common/Card';
import { PlannerIcon } from '../icons/PlannerIcon';
import GeminiService from '../../services/geminiService';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAppContext } from '../../contexts/AppContext';
import useLocalStorage from '../../hooks/useLocalStorage';
import { ChevronUpIcon } from '../icons/ChevronUpIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { PencilIcon } from '../icons/PencilIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { DocumentTextIcon } from '../icons/DocumentTextIcon';
import { CloseIcon } from '../icons/CloseIcon';
import MarkdownRenderer from '../common/MarkdownRenderer';
import { PanelCollapseIcon } from '../icons/PanelCollapseIcon';
import { PanelExpandIcon } from '../icons/PanelExpandIcon';

const OLD_PLANNER_TASKS_KEY = 'easyway-planner-tasks';
const STUDY_PLANS_KEY = 'easyway-study-plans';
const ACTIVE_PLAN_ID_KEY = 'easyway-active-plan-id';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const Calendar: React.FC<{ onDateSelect: (date: string) => void; selectedDate: string; tasks: PlannerTask[] }> = ({ onDateSelect, selectedDate, tasks }) => {
  const [date, setDate] = useState(new Date(selectedDate));

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const taskDates = useMemo(() => new Set(tasks.map(t => t.date)), [tasks]);

  const renderDays = () => {
    const month = date.getMonth();
    const year = date.getFullYear();
    const totalDays = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>);
    }
    for (let i = 1; i <= totalDays; i++) {
      const dayDate = new Date(year, month, i);
      const dayString = dayDate.toISOString().split('T')[0];
      const isSelected = selectedDate === dayString;
      const hasTask = taskDates.has(dayString);
      
      const dayClasses = `p-2 text-center rounded-full cursor-pointer transition-colors relative ${
        isSelected ? 'bg-[rgb(var(--color-primary))] text-white font-bold' : 'text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-input))]'
      }`;
      
      days.push(
        <div key={i} className={dayClasses} onClick={() => onDateSelect(dayString)}>
          {i}
          {hasTask && <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-[rgb(var(--color-accent))]'}`}></div>}
        </div>
      );
    }
    return days;
  };

  const changeMonth = (offset: number) => {
    setDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };
  
  return (
    <Card className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-[rgb(var(--color-input))]">&lt;</button>
        <h2 className="font-bold text-lg">{date.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
        <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-[rgb(var(--color-input))]">&gt;</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[rgb(var(--color-text-secondary))] text-sm">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>
      <div className="grid grid-cols-7 gap-1 mt-2">{renderDays()}</div>
    </Card>
  );
};

const PlannerView: React.FC = () => {
    const [plans, setPlans] = useLocalStorage<StudyPlan[]>(STUDY_PLANS_KEY, []);
    const [activePlanId, setActivePlanId] = useLocalStorage<string | null>(ACTIVE_PLAN_ID_KEY, null);

    const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
    const [newTaskTitle, setNewTaskTitle] = useState('');
    
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
    const [generatedPlanPreview, setGeneratedPlanPreview] = useState<PlannerTask[] | null>(null);
    const [planGenerationError, setPlanGenerationError] = useState<string | null>(null);

    const [viewingTask, setViewingTask] = useState<PlannerTask | null>(null);
    
    const [isPlansPanelOpen, setIsPlansPanelOpen] = useState(true);
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
    const [editingPlanName, setEditingPlanName] = useState('');

    const [isSidePanelCollapsed, setIsSidePanelCollapsed] = useState(false);

    const geminiService = useMemo(() => new GeminiService(), []);

    useEffect(() => {
      const oldTasksRaw = localStorage.getItem(OLD_PLANNER_TASKS_KEY);
      if (oldTasksRaw && plans.length === 0) {
        try {
          const oldTasks = JSON.parse(oldTasksRaw) as PlannerTask[];
          if (Array.isArray(oldTasks) && oldTasks.length > 0) {
            const newPlan: StudyPlan = {
              id: `plan-${Date.now()}`,
              name: 'My Study Plan',
              tasks: oldTasks,
              createdAt: Date.now(),
            };
            setPlans([newPlan]);
            setActivePlanId(newPlan.id);
            localStorage.removeItem(OLD_PLANNER_TASKS_KEY);
          }
        } catch (e) { console.error("Failed to migrate old tasks", e); }
      } else if (plans.length === 0) {
        const defaultPlan: StudyPlan = {
          id: `plan-${Date.now()}`,
          name: 'ALL GOV Prelims 2025',
          tasks: [],
          createdAt: Date.now(),
        };
        setPlans([defaultPlan]);
        setActivePlanId(defaultPlan.id);
      }
  
      if (!activePlanId && plans.length > 0) {
        setActivePlanId(plans.sort((a,b) => a.createdAt - b.createdAt)[0].id);
      }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const activePlan = useMemo(() => plans.find(p => p.id === activePlanId), [plans, activePlanId]);

    const updatePlan = (planId: string, updateFn: (plan: StudyPlan) => StudyPlan) => {
        setPlans(prev => prev.map(p => p.id === planId ? updateFn(p) : p));
    }

    const handleAddTask = () => {
        if(newTaskTitle.trim() === '' || !activePlanId) return;
        const newTask: PlannerTask = {
            id: `task-${Date.now()}`,
            title: newTaskTitle.trim(),
            date: selectedDate,
            completed: false
        };
        updatePlan(activePlanId, plan => ({...plan, tasks: [...plan.tasks, newTask]}));
        setNewTaskTitle('');
    };

    const handleToggleTask = (taskId: string) => {
        if(!activePlanId) return;
        updatePlan(activePlanId, plan => ({...plan, tasks: plan.tasks.map(task => task.id === taskId ? {...task, completed: !task.completed} : task)}));
    };

    const handleDeleteTask = (taskId: string) => {
        if(!activePlanId) return;
        updatePlan(activePlanId, plan => ({...plan, tasks: plan.tasks.filter(task => task.id !== taskId)}));
    };

    const handleGeneratePlan = useCallback(async () => {
        if (aiPrompt.trim() === '') return;
        setIsGeneratingPlan(true);
        setPlanGenerationError(null);
        setGeneratedPlanPreview(null);
        try {
            const planTasks = await geminiService.generateStudyPlan(aiPrompt);
            const fullTasks: PlannerTask[] = planTasks.map(task => ({
                ...task,
                id: `task-${Date.now()}-${Math.random()}`,
                completed: false
            }));
            setGeneratedPlanPreview(fullTasks);
        } catch (error) {
            console.error("Failed to generate study plan:", error);
            setPlanGenerationError("Sorry, an error occurred while generating the plan. Please try again.");
        } finally {
            setIsGeneratingPlan(false);
        }
    }, [aiPrompt, geminiService]);

    const addGeneratedTasksToPlan = () => {
        if (!generatedPlanPreview || !activePlanId) return;
        updatePlan(activePlanId, plan => ({
            ...plan,
            tasks: [...plan.tasks, ...generatedPlanPreview]
        }));
        setGeneratedPlanPreview(null);
        setAiPrompt('');
    };

    const handleCreatePlan = () => {
        const newPlan: StudyPlan = {
            id: `plan-${Date.now()}`,
            name: `New Plan ${plans.length + 1}`,
            tasks: [],
            createdAt: Date.now()
        };
        setPlans(prev => [...prev, newPlan]);
        setActivePlanId(newPlan.id);
    }
    
    const handleDeletePlan = (planId: string) => {
        setPlans(prev => prev.filter(p => p.id !== planId));
        if(activePlanId === planId) {
            const remaining = plans.filter(p => p.id !== planId);
            setActivePlanId(remaining.length > 0 ? remaining[0].id : null);
        }
    }

    const handleStartEditing = (plan: StudyPlan) => {
        setEditingPlanId(plan.id);
        setEditingPlanName(plan.name);
    }

    const handleSaveEdit = () => {
        if (editingPlanId) {
            updatePlan(editingPlanId, plan => ({...plan, name: editingPlanName.trim() || 'Untitled Plan'}));
        }
        setEditingPlanId(null);
    }

    const tasksForSelectedDate = activePlan?.tasks.filter(task => task.date === selectedDate) || [];
    const dateDisplay = new Date(selectedDate + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const inputStyle = "w-full bg-[rgb(var(--color-input))] border border-[rgb(var(--color-border))] rounded-lg p-2 text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-secondary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--color-background-start))] focus-visible:ring-[rgb(var(--color-primary))] transition-all duration-200";

    const PlanItem: React.FC<{plan: StudyPlan}> = ({ plan }) => {
        const completedTasks = plan.tasks.filter(t => t.completed).length;
        const totalTasks = plan.tasks.length;
        const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        
        return (
            <div className={`p-3 rounded-lg group transition-colors ${activePlanId === plan.id ? 'bg-[rgb(var(--color-input))] border border-[rgb(var(--color-primary))]' : 'hover:bg-[rgb(var(--color-input))]'}`}>
                <div className="flex items-center justify-between gap-2">
                    {editingPlanId === plan.id ? (
                        <input
                            type="text"
                            value={editingPlanName}
                            onChange={e => setEditingPlanName(e.target.value)}
                            onBlur={handleSaveEdit}
                            onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                            className={`${inputStyle} text-sm p-1 flex-1`}
                            autoFocus
                        />
                    ) : (
                        <div className="flex-1 cursor-pointer" onClick={() => setActivePlanId(plan.id)}>
                            <p className="font-semibold text-sm truncate">{plan.name}</p>
                            <p className="text-xs text-[rgb(var(--color-text-secondary))]">{completedTasks} / {totalTasks} tasks completed</p>
                        </div>
                    )}
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleStartEditing(plan)} className="p-1 hover:text-white"><PencilIcon className="w-4 h-4" /></button>
                        <button onClick={() => handleDeletePlan(plan.id)} className="p-1 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                    </div>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1 mt-2">
                    <div className="bg-[rgb(var(--color-primary))] h-1 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
        )
    };

    const TaskItem: React.FC<{task: PlannerTask}> = ({task}) => {
        return (
             <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
                <div className="flex items-center justify-between bg-[rgb(var(--color-input))] p-3 rounded-lg group">
                    <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        <input type="checkbox" checked={task.completed} onChange={() => handleToggleTask(task.id)} className="w-5 h-5 accent-[rgb(var(--color-primary))] bg-[rgb(var(--color-sidebar))] rounded border-[rgb(var(--color-border))] flex-shrink-0" />
                        <span className={`truncate ${task.completed ? 'line-through text-slate-500' : ''}`}>{task.title}</span>
                        {task.notes && (
                            <button onClick={() => setViewingTask(task)} className="text-[rgb(var(--color-text-secondary))] hover:text-white transition-colors">
                                <DocumentTextIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <button onClick={() => handleDeleteTask(task.id)} className="text-slate-500 hover:text-red-500 text-xl font-bold opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                </div>
            </motion.div>
        );
    };

    return (
        <div className="p-6 h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
                     <button onClick={() => setIsSidePanelCollapsed(p => !p)} className="absolute -left-4 top-2 z-10 lg:hidden p-2 bg-[rgb(var(--color-card))] rounded-full border border-[rgb(var(--color-border))]">
                        {isSidePanelCollapsed ? <PanelExpandIcon /> : <PanelCollapseIcon />}
                    </button>

                    <div className={`lg:col-span-1 flex-col gap-6 transition-all duration-300 ${isSidePanelCollapsed ? 'hidden lg:flex' : 'flex'}`}>
                        <Card>
                            <div className="flex justify-between items-center">
                                <div onClick={() => setIsPlansPanelOpen(prev => !prev)} className="flex-1 flex justify-between items-center cursor-pointer">
                                    <h2 className="text-xl font-bold">Study Plans</h2>
                                    {isPlansPanelOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
                                </div>
                                 <button onClick={() => setIsSidePanelCollapsed(p => !p)} className="hidden lg:block p-1 ml-4 text-[rgb(var(--color-text-secondary))] hover:text-white">
                                    <PanelCollapseIcon />
                                </button>
                            </div>
                            <AnimatePresence>
                                {isPlansPanelOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                        animate={{ height: 'auto', opacity: 1, marginTop: '1rem' }}
                                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="space-y-3">
                                            {plans.map(plan => <PlanItem key={plan.id} plan={plan} />)}
                                        </div>
                                        <button onClick={handleCreatePlan} className="w-full mt-4 flex items-center justify-center gap-2 text-sm p-2 rounded-lg bg-[rgb(var(--color-input))] hover:bg-slate-700 text-[rgb(var(--color-text-secondary))] hover:text-white transition-colors">
                                            <PlusIcon className="w-4 h-4" /> Create New Plan
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </Card>
                        <Calendar onDateSelect={setSelectedDate} selectedDate={selectedDate} tasks={activePlan?.tasks || []} />
                        <Card>
                            <h2 className="text-xl font-bold mb-4">AI Plan Generator</h2>
                            <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-4">Describe your goal, and the AI will create a dated study plan with notes for you.</p>
                            <textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="e.g., 'A 2-week plan for Modern History, focusing on the freedom struggle.'"
                                className={`${inputStyle} mb-3 min-h-[80px]`}
                                disabled={isGeneratingPlan}
                            />
                            <button onClick={handleGeneratePlan} disabled={isGeneratingPlan || aiPrompt.trim() === ''} className="w-full p-2 bg-[rgb(var(--color-primary))] text-white font-semibold rounded-lg hover:bg-[rgb(var(--color-primary-hover))] disabled:bg-slate-600">
                                {isGeneratingPlan ? <LoadingSpinner /> : 'Generate Plan'}
                            </button>
                        </Card>
                    </div>
                    <div className={`${isSidePanelCollapsed ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
                        {isSidePanelCollapsed && (
                             <button onClick={() => setIsSidePanelCollapsed(false)} className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 p-2 bg-[rgb(var(--color-card))] rounded-full border border-[rgb(var(--color-border))]">
                                <PanelExpandIcon />
                            </button>
                        )}
                        <Card>
                            <h2 className="text-xl font-bold mb-4">Tasks for {dateDisplay}</h2>
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    value={newTaskTitle}
                                    onChange={e => setNewTaskTitle(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                                    placeholder="Add new task manually..."
                                    className={`flex-1 ${inputStyle}`}
                                    disabled={!activePlan}
                                />
                                <button onClick={handleAddTask} disabled={!activePlan} className="p-2 px-4 bg-[rgb(var(--color-primary))] text-white font-semibold rounded-lg hover:bg-[rgb(var(--color-primary-hover))] disabled:bg-slate-600">Add</button>
                            </div>
                            <div className="space-y-3">
                                <AnimatePresence>
                                {tasksForSelectedDate.length > 0 ? tasksForSelectedDate.map(task => (
                                    <TaskItem key={task.id} task={task} />
                                )) : (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        <div className="text-center text-[rgb(var(--color-text-secondary))] py-8">
                                            <PlannerIcon className="mx-auto w-12 h-12 mb-4" />
                                            <p>{activePlan ? 'No tasks for this day. Add one above!' : 'Select a study plan to view tasks.'}</p>
                                        </div>
                                    </motion.div>
                                )}
                                </AnimatePresence>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            {/* AI Plan Preview Modal */}
            <AnimatePresence>
                {generatedPlanPreview && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[rgb(var(--color-card))] w-full max-w-2xl rounded-xl border border-[rgb(var(--color-border))] shadow-2xl flex flex-col max-h-[90vh]"
                        >
                            <div className="p-4 border-b border-[rgb(var(--color-border))]">
                                <h2 className="text-lg font-bold">AI Generated Plan</h2>
                                <p className="text-sm text-[rgb(var(--color-text-secondary))]">Review the generated tasks and add them to your plan.</p>
                            </div>
                            <div className="flex-1 p-4 overflow-y-auto space-y-3">
                                {generatedPlanPreview.map(task => (
                                    <div key={task.id} className="p-3 rounded-lg bg-[rgb(var(--color-input))]">
                                        <p className="font-bold">{task.title} <span className="font-normal text-sm text-[rgb(var(--color-text-secondary))]">({task.date})</span></p>
                                        <MarkdownRenderer content={task.notes || ''} className="prose-sm mt-2" />
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 border-t border-[rgb(var(--color-border))] flex justify-end gap-3">
                                <button onClick={() => setGeneratedPlanPreview(null)} className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600">Cancel</button>
                                <button onClick={addGeneratedTasksToPlan} className="px-4 py-2 bg-[rgb(var(--color-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-primary-hover))]" disabled={!activePlan}>Add to "{activePlan?.name}"</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
                {planGenerationError && (
                     <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 flex items-center justify-center p-4"
                        onClick={() => setPlanGenerationError(null)}
                    >
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-[rgb(var(--color-card))] p-6 rounded-lg border border-red-500/50">
                            <p className="text-red-400">{planGenerationError}</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Task Notes Modal */}
             <AnimatePresence>
                {viewingTask && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 flex items-center justify-center p-4"
                        onClick={() => setViewingTask(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[rgb(var(--color-card))] w-full max-w-2xl rounded-xl border border-[rgb(var(--color-border))] shadow-2xl flex flex-col max-h-[80vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-4 flex justify-between items-center border-b border-[rgb(var(--color-border))]">
                               <div>
                                 <h2 className="text-lg font-bold">{viewingTask.title}</h2>
                                 <p className="text-sm text-[rgb(var(--color-text-secondary))]">{new Date(viewingTask.date + 'T12:00:00Z').toLocaleDateString()}</p>
                               </div>
                               <button onClick={() => setViewingTask(null)} className="p-2 rounded-full hover:bg-[rgb(var(--color-input))]"><CloseIcon /></button>
                            </div>
                            <div className="flex-1 p-6 overflow-y-auto">
                                <MarkdownRenderer content={viewingTask.notes || ''} />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PlannerView;