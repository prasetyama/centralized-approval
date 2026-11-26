import { useState, useEffect } from 'react';
import { ShoppingCart, Wallet, Users, FileText, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card';
import { Badge } from '@/components/atoms/Badge';
import { formatCurrency } from '@/lib/utils';
import { prNonTradeService } from '@/services/prNonTradeService';

interface PayloadRendererProps {
    moduleCode: string;
    payload: any;
}

const DescriptionBadge = ({ desc }: { desc: string }) => {
    if (!desc) return null;
    return (
        <div className="mt-1 flex items-center gap-1.5 text-sm py-1 rounded-lg text-slate-700 max-w-full">
            <span className="font-semibold text-slate-800 truncate" title={desc}>{desc}</span>
        </div>
    );
};

export const PayloadRenderer = ({ moduleCode, payload }: PayloadRendererProps) => {
    const [carTbrDesc, setCarTbrDesc] = useState('');
    const [assetDesc, setAssetDesc] = useState('');
    const [wbsDesc, setWbsDesc] = useState('');
    const [equipmentDesc, setEquipmentDesc] = useState('');

    useEffect(() => {
        setCarTbrDesc('');
        setAssetDesc('');
        setWbsDesc('');
        setEquipmentDesc('');

        if (moduleCode !== 'PR_NON_TRADE' || !payload) return;

        if (payload.car_tbr_no) {
            prNonTradeService.searchCarNumbers(payload.car_tbr_no).then(res => {
                const list = Array.isArray(res) ? res : res.results || [];
                const match = list.find(i => String(i.code).trim() === String(payload.car_tbr_no).trim()) || list[0];
                if (match) setCarTbrDesc(match.description || match.name || '');
            }).catch(() => { });
        }
        if (payload.asset_no) {
            prNonTradeService.searchAssets(payload.asset_no).then(res => {
                const list = Array.isArray(res) ? res : res.results || [];
                const match = list.find(i => String(i.code).trim() === String(payload.asset_no).trim()) || list[0];
                if (match) setAssetDesc(match.description || match.name || match.category || '');
            }).catch(() => { });
        }
        if (payload.wbs_no) {
            prNonTradeService.searchWBS(payload.wbs_no).then(res => {
                const list = Array.isArray(res) ? res : res.results || [];
                const match = list.find(i => String(i.code).trim() === String(payload.wbs_no).trim()) || list[0];
                if (match) setWbsDesc(match.description || match.name || '');
            }).catch(() => { });
        }
        if (payload.equipment_name) {
            prNonTradeService.searchEquipments(payload.equipment_name).then(res => {
                const list = Array.isArray(res) ? res : res.results || [];
                const match = list.find(i => String(i.code).trim() === String(payload.equipment_name).trim() || (i.name && i.name.trim() === String(payload.equipment_name).trim())) || list[0];
                if (match) setEquipmentDesc(match.description || (match.plant ? `Plant: ${match.plant}` : '') || '');
            }).catch(() => { });
        }
    }, [moduleCode, payload?.car_tbr_no, payload?.asset_no, payload?.wbs_no, payload?.equipment_name]);
    const renderEOrder = () => (
        <div className="space-y-6 overflow-x-auto">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-500 uppercase">Distributor</p>
                    <p className="font-medium text-slate-900">{payload.distributor || '-'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-500 uppercase">Order Type</p>
                    <Badge variant="info">
                        {payload.order_type === '1' ? 'Fix Order' :
                            payload.order_type === '2' ? 'Additional Order' :
                                payload.order_type === '3' ? 'Urgent Order' : 'Unknown'}
                    </Badge>
                </div>
            </div>

            <div className="rounded-xl border border-slate-100">
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
                                <td className="px-4 py-3 text-right text-slate-600">{item.qty} {item.uom}</td>
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
                    <p className="text-sm font-semibold text-slate-500 uppercase">Claim Category</p>
                    <p className="font-medium text-slate-900">{payload.category || '-'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-500 uppercase">Expense Date</p>
                    <p className="font-medium text-slate-900">{payload.expense_date || '-'}</p>
                </div>
            </div>

            <div className="bg-emerald-50/30 rounded-xl p-4 border border-emerald-100">
                <p className="text-sm font-bold text-emerald-700 uppercase mb-2">Total Claim Amount</p>
                <p className="text-2xl font-black text-emerald-800 tracking-tight">
                    {formatCurrency(payload.amount)}
                </p>
            </div>

            <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-500 uppercase">Description</p>
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
                    <p className="text-sm font-semibold text-slate-500 uppercase">Leave Type</p>
                    <Badge variant="secondary" className="px-3 py-1 font-bold text-sm">
                        {payload.leave_type.toUpperCase()}
                    </Badge>
                </div>
                <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-500 uppercase">Duration</p>
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
                <p className="text-sm font-semibold text-slate-500 uppercase">Reason for Leave</p>
                <div className="flex gap-3 items-start bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-700 italic leading-relaxed">
                        "{payload.reason}"
                    </p>
                </div>
            </div>
        </div>
    );

    const renderPRNonTrade = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-500 uppercase">Purpose</p>
                    <p className="text-lg font-bold text-slate-900">{payload.purpose}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-500 uppercase">Requestor</p>
                    <p className="font-medium text-slate-900">{payload.requestor_name + " - " + payload.requester_department + " - " + payload.requester_company || '-'}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-500 uppercase">Equipment Name</p>
                    <p className="text-lg font-bold text-slate-900">{payload.equipment_name || '-'}</p>
                    <DescriptionBadge desc={equipmentDesc} />
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-500 uppercase">CAR/TBR No.</p>
                    <p className="font-medium text-slate-900">{payload.car_tbr_no || '-'}</p>
                    <DescriptionBadge desc={carTbrDesc} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                {payload.asset_type == 'non_wbs' && (
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-500 uppercase">Asset Number</p>
                        <p className="text-lg font-bold text-slate-900">{payload.asset_no || '-'}</p>
                        <DescriptionBadge desc={assetDesc} />
                    </div>
                )}
                {payload.asset_type == 'wbs' && (
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-500 uppercase">WBS Number</p>
                        <p className="text-lg font-bold text-slate-900">{payload.wbs_no || '-'}</p>
                        <DescriptionBadge desc={wbsDesc} />
                    </div>
                )}
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-500 uppercase">Asset Type</p>
                    <p className="font-medium text-slate-900">{payload.asset_type == 'wbs' ? 'WBS' : payload.asset_type == 'non_wbs' ? 'Non WBS' : '-'}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-500 uppercase">Purchase Type</p>
                    <p className="text-lg font-bold text-slate-900">{payload.purchase_type == 'asset' ? 'Assets' : 'Non Assets'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-500 uppercase">Goods/Service Type</p>
                    <p className="font-medium text-slate-900">{payload.goods_service_type == 'not_lumpsum' ? 'Non Lumpsum' : 'Lumpsum'}</p>
                </div>
            </div>
            <div className="rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th className="px-4 py-2 text-left font-semibold text-slate-600">Item</th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-600">Qty</th>
                            <th className="px-4 py-2 text-right font-semibold text-slate-600">Remark</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {(payload.items || []).map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 font-medium text-slate-800">{item.description}</td>
                                <td className="px-4 py-3 text-right text-slate-600">{item.quantity} {item.unit}</td>
                                <td className="px-4 py-3 text-right text-slate-600">{item.remark}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-500 uppercase">Remark</p>
                    <p className="text-lg font-bold text-slate-900">{payload.submission_remark}</p>
                </div>
            </div>
        </div>
    );

    const renderGeneric = () => (
        <pre className="p-4 bg-slate-900 text-slate-50 rounded-xl overflow-auto text-sm font-mono max-h-[400px]">
            {JSON.stringify(payload, null, 2)}
        </pre>
    );

    const getModuleConfig = () => {
        switch (moduleCode) {
            case 'EORDER': return { title: 'Purchase Order Details', icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50' };
            case 'FINANCE': return { title: 'Expense Claim Details', icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' };
            case 'HR': return { title: 'Leave Request Details', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' };
            case 'PR_NON_TRADE': return { title: 'PR Non-Trade Details', icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' };
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
                    <p className="text-sm text-slate-500 font-medium mt-0.5">Reference: {payload.reference_id || payload.transaction_id || 'N/A'}</p>
                </div>
            </CardHeader>
            <CardContent className="pt-6 w-full overflow-x-auto">
                {moduleCode === 'EORDER' ? renderEOrder() :
                    moduleCode === 'FINANCE' ? renderFinance() :
                        moduleCode === 'HR' ? renderHR() :
                            moduleCode === 'PR_NON_TRADE' ? renderPRNonTrade() :
                                renderGeneric()}
            </CardContent>
        </Card>
    );
};
