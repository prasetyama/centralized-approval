import React from 'react';
import { MessageSquare } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Feedback {
    id: number;
    user_name: string; // The mentioned user
    created_by_name: string; // The author
    content: string;
    created_at: string;
}

interface FeedbackListProps {
    feedbacks: Feedback[];
}

export const FeedbackList: React.FC<FeedbackListProps> = ({ feedbacks }) => {
    if (feedbacks.length === 0) {
        return (
            <div className="text-center py-12 px-4">
                <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="text-slate-400" size={24} />
                </div>
                <h3 className="text-slate-900 font-semibold mb-1">No feedback yet</h3>
                <p className="text-slate-500 text-sm">Be the first to start the discussion.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {feedbacks.map((item) => (
                <div
                    key={item.id}
                    className="p-4 rounded-xl border bg-slate-50 border-slate-100 transition-all duration-200"
                >
                    <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="text-slate-400" size={18} />
                            <span className="font-bold text-slate-900 text-sm">{item.created_by_name}</span>
                            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                                {formatDate(item.created_at)}
                            </span>
                        </div>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {item.content}
                    </p>
                </div>
            ))}
        </div>
    );
};
