import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

interface FeedbackFormProps {
    onSubmit: (content: string, mentionedUserId: number | null) => Promise<void>;
    isLoading?: boolean;
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({ onSubmit, isLoading }) => {
    const [content, setContent] = useState('');
    const [mentionedUserId, setMentionedUserId] = useState<number | null>(null);
    const [isHidden, setIsHidden] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;
        await onSubmit(content, mentionedUserId);
        setContent('');
        setMentionedUserId(null);
        setIsHidden(false);
    };

    const { data: users } = useQuery<any>({
        queryKey: ['admin-users'],
        queryFn: () => api.get('/admin/users'),
    });

    return (
        <form onSubmit={handleSubmit} className="space-y-4">

            <div className="relative group">
                <textarea
                    value={content}
                    onChange={(e) => {
                        const val = e.target.value;
                        setContent(val);
                        // Reset hidden state if user types @ again
                        if (val.endsWith('@')) {
                            setIsHidden(false);
                        }
                    }}
                    placeholder="Provide your feedback or ask a question..."
                    className="w-full min-h-[120px] p-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all resize-none text-sm leading-relaxed"
                    required
                />
                {content.includes('@') && !isHidden && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-100 shadow-lg rounded-lg p-2 z-10 animate-in fade-in zoom-in duration-200 feedback overflow-y-auto max-h-[200px]">
                        <p className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">Suggested Mentions</p>
                        <div className="space-y-1">
                            {users?.results?.map((user: any) => (
                                <button
                                    key={user.id}
                                    type="button"
                                    className="w-full text-left px-2 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 rounded transition-colors flex items-center gap-2"
                                    onClick={() => {
                                        const textBeforeMention = content.split('@')[0];
                                        setContent(textBeforeMention + '@' + user.first_name + ' ' + user.last_name + ' ');
                                        setMentionedUserId(user.id);
                                        setIsHidden(true);
                                    }}
                                >
                                    <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                                        {user.first_name[0]}
                                    </div>
                                    {user.first_name + ' ' + user.last_name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div className="absolute bottom-3 right-3">
                    <Button
                        type="submit"
                        size="sm"
                        disabled={isLoading || !content.trim()}
                        className="rounded-lg shadow-md hover:shadow-lg transition-all"
                    >
                        {isLoading ? (
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <Send size={14} className="mr-1.5" />
                                Post
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </form>
    );
};
