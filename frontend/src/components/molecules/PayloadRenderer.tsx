import { ShoppingCart, Wallet, Users, FileText, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card';
import { Badge } from '@/components/atoms/Badge';
import { formatCurrency } from '@/lib/utils';

interface PayloadRendererProps {
    moduleCode: string;
    payload: any;
}

export const PayloadRenderer = ({ moduleCode, payload }: PayloadRendererProps) => {
    const renderEOrder = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Distributor</p>
                    <p className="font-medium text-slate-900">{payload.distributor || '-'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Order Type</p>
                    <Badge variant="info">
                        {payload.order_type === '1' ? 'Fix Order' :
                            payload.order_type === '2' ? 'Additional Order' :
                                payload.order_type === '3' ? 'Urgent Order' : 'Unknown'}
                    </Badge>
                </div>
            </div>

            <div className="rounded-xl border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th className="px-4 py-2 text-left font-semibold text-slate-600">Product</th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-600">Qty</th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-600">Price</th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-600">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {(payload.items || []).map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                                <td className="px-4 py-3 text-right text-slate-600">{item.qty}</td>
                                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(item.price)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                    {formatCurrency(item.qty * item.price)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-50/50 font-bold">
                        <tr>
                            <td colSpan={3} className="px-4 py-3 text-right text-slate-700">Grand Total</td>
                            <td className="px-4 py-3 text-right text-blue-700 text-lg">
                                {formatCurrency(payload.total_amount)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );

    const renderFinance = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Claim Category</p>
                    <p className="font-medium text-slate-900">{payload.category || '-'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Expense Date</p>
                    <p className="font-medium text-slate-900">{payload.expense_date || '-'}</p>
                </div>
            </div>

            <div className="bg-emerald-50/30 rounded-xl p-4 border border-emerald-100">
                <p className="text-xs font-bold text-emerald-700 uppercase mb-2">Total Claim Amount</p>
                <p className="text-2xl font-black text-emerald-800 tracking-tight">
                    {formatCurrency(payload.amount)}
                </p>
            </div>

            <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">Description</p>
                <p className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    {payload.description}
                </p>
            </div>
        </div>
    );

    const renderHR = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Leave Type</p>
                    <Badge variant="secondary" className="px-3 py-1 font-bold text-sm">
                        {payload.leave_type.toUpperCase()}
                    </Badge>
                </div>
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Duration</p>
                    <p className="text-lg font-bold text-slate-900">{payload.days} Business Days</p>
                </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50/50 border border-blue-100">
                <div className="space-y-1">
                    <p className="text-[10px] font-bold text-blue-700 uppercase">Start Date</p>
                    <p className="font-bold text-slate-900">{payload.start_date}</p>
                </div>
                <div className="h-8 w-px bg-blue-200"></div>
                <div className="space-y-1 text-right">
                    <p className="text-[10px] font-bold text-blue-700 uppercase">End Date</p>
                    <p className="font-bold text-slate-900">{payload.end_date}</p>
                </div>
            </div>

            <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">Reason for Leave</p>
                <div className="flex gap-3 items-start bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-700 italic leading-relaxed">
                        "{payload.reason}"
                    </p>
                </div>
            </div>
        </div>
    );

    const renderGeneric = () => (
        <pre className="p-4 bg-slate-900 text-slate-50 rounded-xl overflow-auto text-xs font-mono max-h-[400px]">
            {JSON.stringify(payload, null, 2)}
        </pre>
    );

    const getModuleConfig = () => {
        switch (moduleCode) {
            case 'EORDER': return { title: 'Purchase Order Details', icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50' };
            case 'FINANCE': return { title: 'Expense Claim Details', icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' };
            case 'HR': return { title: 'Leave Request Details', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' };
            default: return { title: 'Request Payload', icon: FileText, color: 'text-slate-600', bg: 'bg-slate-50' };
        }
    };

    const config = getModuleConfig();

    return (
        <Card className="border-slate-100 shadow-sm bg-slate-50/30">
            <CardHeader className="flex flex-row items-center gap-4 border-b border-slate-100 bg-white rounded-t-xl">
                <div className={`p-2 rounded-lg ${config.bg}`}>
                    <config.icon className={config.color} size={20} />
                </div>
                <div>
                    <CardTitle className="text-lg">{config.title}</CardTitle>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Reference: {payload.reference_id || 'N/A'}</p>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                {moduleCode === 'EORDER' ? renderEOrder() :
                    moduleCode === 'FINANCE' ? renderFinance() :
                        moduleCode === 'HR' ? renderHR() :
                            renderGeneric()}
            </CardContent>
        </Card>
    );
};
