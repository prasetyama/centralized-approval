import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
    FileText, User, Building, Landmark, Calendar,
    Plus, Trash2, Edit2, Save, X, Search,
    Send, ArrowLeft, Loader2, Info, Package, Layers, Store
} from 'lucide-react';
import {
    prNonTradeService, PRNonTradeData, PRNonTradeItem, MasterItem
} from '../services/prNonTradeService';
import { MasterSearchModal } from '../components/organisms/MasterSearchModal';
import { PRTradeDummyForm } from '../components/organisms/PRTradeDummyForm';

export const PRNonTradeFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const toast = useToast();

    const [searchParams, setSearchParams] = useSearchParams();
    const initialPrType = searchParams.get('type') === 'trade' ? 'trade' : 'non_trade';
    const [prType, setPrType] = useState<'non_trade' | 'trade'>(initialPrType);

    const handleSwitchPrType = (type: 'non_trade' | 'trade') => {
        if (id) {
            toast.info('Draft Non-Trade ini tidak dapat diubah ke tipe Trade.');
            return;
        }
        setPrType(type);
        setSearchParams(type === 'trade' ? { type: 'trade' } : {});
    };

    const todayDate = new Date().toISOString().split('T')[0];

    // Form state
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);

    const [transactionId, setTransactionId] = useState('');
    const [transactionDate, setTransactionDate] = useState(todayDate);
    const [requestorName, setRequestorName] = useState(user?.name || user?.first_name || user?.username || '');
    const [requesterDepartment, setRequesterDepartment] = useState(user?.department || '');
    const [requesterCompany, setRequesterCompany] = useState((user as any)?.company || '');

    // General Data
    const [purpose, setPurpose] = useState('');
    const [goodsServiceType, setGoodsServiceType] = useState<'lumpsum' | 'not_lumpsum'>('not_lumpsum');
    const [purchaseType, setPurchaseType] = useState<'asset' | 'non_asset'>('non_asset');
    const [carTbrNo, setCarTbrNo] = useState('');
    const [assetType, setAssetType] = useState<'non_wbs' | 'wbs'>('non_wbs');
    const [assetNo, setAssetNo] = useState('');
    const [wbsNo, setWbsNo] = useState('');
    const [equipmentName, setEquipmentName] = useState('');
    const [submissionRemark, setSubmissionRemark] = useState('');

    // Items list
    const [items, setItems] = useState<PRNonTradeItem[]>([]);

    // Item editing state
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
    const [itemForm, setItemForm] = useState<PRNonTradeItem>({
        goods_code: '',
        goods_name: '',
        unit: 'PCS',
        quantity: 1,
        remark: ''
    });

    // Master Data Modal state
    const [modalType, setModalType] = useState<'asset' | 'wbs' | 'equipment' | 'goods' | null>(null);

    // Sync user info if user changes
    useEffect(() => {
        if (user) {
            if (!requestorName) setRequestorName(user.name || `${user.first_name} ${user.last_name}`.trim() || user.username);
            if (!requesterDepartment && user.department) setRequesterDepartment(user.department);
            if (!requesterCompany && (user as any).company) setRequesterCompany((user as any).company);
        }
    }, [user]);

    // Load existing draft if ID param present
    useEffect(() => {
        if (!id) return;
        const loadDetail = async () => {
            setLoading(true);
            try {
                const data = await prNonTradeService.getDetail(id);
                setTransactionId(data.transaction_id || '');
                setTransactionDate(data.transaction_date || todayDate);
                setRequestorName(data.requestor_name || '');
                setRequesterDepartment(data.requester_department || '');
                setRequesterCompany(data.requester_company || '');
                setPurpose(data.purpose || '');
                setGoodsServiceType(data.goods_service_type || 'not_lumpsum');
                setPurchaseType(data.purchase_type || 'non_asset');
                setCarTbrNo(data.car_tbr_no || '');
                setAssetType(data.asset_type || 'non_wbs');
                setAssetNo(data.asset_no || '');
                setWbsNo(data.wbs_no || '');
                setEquipmentName(data.equipment_name || '');
                setSubmissionRemark(data.submission_remark || '');
                setItems(data.items || []);
            } catch (err: any) {
                toast.error('Gagal memuat data draft PR Non-Trade.');
            } finally {
                setLoading(false);
            }
        };
        loadDetail();
    }, [id]);

    // Item handlers
    const handleAddItem = () => {
        if (!itemForm.goods_code || !itemForm.goods_name) {
            toast.error('Kode barang dan Nama barang wajib diisi!');
            return;
        }
        if (editingItemIndex !== null) {
            const updated = [...items];
            updated[editingItemIndex] = { ...itemForm };
            setItems(updated);
            setEditingItemIndex(null);
            toast.info('Item berhasil diperbarui.');
        } else {
            setItems([...items, { ...itemForm }]);
            toast.info('Item berhasil ditambahkan.');
        }
        setItemForm({ goods_code: '', goods_name: '', unit: 'PCS', quantity: 1, remark: '' });
    };

    const handleEditItem = (index: number) => {
        setEditingItemIndex(index);
        setItemForm({ ...items[index] });
    };

    const handleDeleteItem = (index: number) => {
        const updated = items.filter((_, i) => i !== index);
        setItems(updated);
        if (editingItemIndex === index) {
            setEditingItemIndex(null);
            setItemForm({ goods_code: '', goods_name: '', unit: 'PCS', quantity: 1, remark: '' });
        }
        toast.info('Item dihapus.');
    };

    const handleCancelItemEdit = () => {
        setEditingItemIndex(null);
        setItemForm({ goods_code: '', goods_name: '', unit: 'PCS', quantity: 1, remark: '' });
    };

    // Save as Draft handler
    const handleSaveDraft = async () => {
        setSavingDraft(true);
        try {
            const formData: PRNonTradeData = {
                id: id ? parseInt(id, 10) : undefined,
                purpose,
                goods_service_type: goodsServiceType,
                purchase_type: purchaseType,
                car_tbr_no: carTbrNo,
                asset_type: purchaseType === 'asset' ? assetType : 'non_wbs',
                asset_no: purchaseType === 'asset' && assetType === 'non_wbs' ? assetNo : '',
                wbs_no: purchaseType === 'asset' && assetType === 'wbs' ? wbsNo : '',
                equipment_name: purchaseType === 'asset' ? equipmentName : equipmentName,
                submission_remark: submissionRemark,
                requester_department: requesterDepartment,
                requester_company: requesterCompany,
                items
            };

            const res = await prNonTradeService.saveDraft(formData);
            if (res.data?.transaction_id) {
                setTransactionId(res.data.transaction_id);
            }
            toast.success(res.message || 'Form berhasil disimpan sebagai Draft.');
            if (res.data?.id && !id) {
                navigate(`/pr-non-trade/${res.data.id}/edit`, { replace: true });
            }
        } catch (err: any) {
            toast.error(typeof err === 'string' ? err : 'Gagal menyimpan draft.');
        } finally {
            setSavingDraft(false);
        }
    };

    // Submit handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!purpose.trim()) {
            toast.error('Purpose (Tujuan pengajuan) wajib diisi!');
            return;
        }
        if (items.length === 0) {
            toast.error('Detail items tidak boleh kosong! Tambahkan minimal 1 item.');
            return;
        }

        setSubmitting(true);
        try {
            const formData: PRNonTradeData = {
                id: id ? parseInt(id, 10) : undefined,
                purpose,
                goods_service_type: goodsServiceType,
                purchase_type: purchaseType,
                car_tbr_no: carTbrNo,
                asset_type: purchaseType === 'asset' ? assetType : 'non_wbs',
                asset_no: purchaseType === 'asset' && assetType === 'non_wbs' ? assetNo : '',
                wbs_no: purchaseType === 'asset' && assetType === 'wbs' ? wbsNo : '',
                equipment_name: purchaseType === 'asset' ? equipmentName : equipmentName,
                submission_remark: submissionRemark,
                requester_department: requesterDepartment,
                requester_company: requesterCompany,
                items
            };

            const res = await prNonTradeService.submitPR(formData);
            toast.success(res.message || 'Pengajuan PR Non-Trade berhasil disubmit!');
            setTimeout(() => {
                navigate('/history');
            }, 1000);
        } catch (err: any) {
            toast.error(typeof err === 'string' ? err : 'Gagal submit PR Non-Trade.');
        } finally {
            setSubmitting(false);
        }
    };

    // Master Data Modal Pickers
    const handleSelectMasterItem = (item: MasterItem) => {
        if (modalType === 'asset') {
            setAssetNo(item.code);
            toast.info(`Asset dipilih: ${item.code} - ${item.name}`);
        } else if (modalType === 'wbs') {
            setWbsNo(item.code);
            toast.info(`WBS dipilih: ${item.code} - ${item.description}`);
        } else if (modalType === 'equipment') {
            setEquipmentName(item.name || item.code);
            toast.info(`Equipment dipilih: ${item.name || item.code}`);
        } else if (modalType === 'goods') {
            setItemForm((prev) => ({
                ...prev,
                goods_code: item.code,
                goods_name: item.name || '',
                unit: item.unit || 'PCS'
            }));
            toast.info(`Goods dipilih: ${item.code} - ${item.name}`);
        }
    };

    const getMasterFetchFn = () => {
        if (modalType === 'asset') return prNonTradeService.searchAssets;
        if (modalType === 'wbs') return prNonTradeService.searchWBS;
        if (modalType === 'equipment') return prNonTradeService.searchEquipments;
        if (modalType === 'goods') return prNonTradeService.searchGoods;
        return async () => [];
    };

    const getModalTitle = () => {
        if (modalType === 'asset') return 'Pencarian Master Asset';
        if (modalType === 'wbs') return 'Pencarian Master WBS';
        if (modalType === 'equipment') return 'Pencarian Master Equipment';
        if (modalType === 'goods') return 'Pencarian Master Goods / Barang';
        return '';
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-500">
                <Loader2 size={36} className="animate-spin text-blue-600" />
                <span className="text-sm font-medium">Memuat form PR Non-Trade...</span>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-6 px-4 space-y-6 font-poppins">
            {/* Header / Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 text-slate-800 p-6 rounded-2xl shadow-md border border-slate-200">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white ${prType === 'trade' ? 'bg-indigo-600' : 'bg-blue-600'}`}>
                        {prType === 'trade' ? <Store size={24} /> : <FileText size={24} />}
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                                {prType === 'trade' ? 'Formulir PR Trade' : 'Formulir PR Non-Trade'}
                            </h1>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold border border-slate-700 transition-colors w-fit"
                >
                    <ArrowLeft size={18} />
                    Kembali
                </button>
            </div>

            {/* DYNAMIC FORM TYPE SELECTOR (TRADE VS NON-TRADE) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                        <h2 className="text-base md:text-lg font-bold text-slate-900">
                            Pilih Jenis Formulir Purchase Request
                        </h2>
                        <p className="text-xs md:text-sm text-slate-500">
                            Satu halaman form dinamis untuk pengadaan Trade (Barang Dagang) dan Non-Trade (Operasional & Aset)
                        </p>
                    </div>
                    {id && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 w-fit">
                            Terkunci ke Non-Trade (Mengedit Draft #{id})
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Non-Trade Option */}
                    <button
                        type="button"
                        onClick={() => handleSwitchPrType('non_trade')}
                        className={`p-4 md:p-5 rounded-2xl border text-left transition-all cursor-pointer relative flex items-start gap-4 ${prType === 'non_trade'
                            ? 'border-blue-600 bg-gradient-to-br from-blue-50/80 to-blue-50/20 ring-2 ring-blue-600/20 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 opacity-80'
                            }`}
                    >
                        <div className='flex flex-row gap-4 items-center w-full'>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${prType === 'non_trade' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'
                                }`}>
                                <Package size={24} />
                            </div>
                            <div className="flex flex-row items-center justify-between w-full">
                                <span className="font-bold text-slate-900 text-xl">PR Non-Trade</span>
                                {prType === 'non_trade' && (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-600 text-white">
                                        Aktif
                                    </span>
                                )}
                            </div>
                        </div>
                    </button>

                    {/* Trade Option (Dummy) */}
                    <button
                        type="button"
                        onClick={() => handleSwitchPrType('trade')}
                        className={`p-4 md:p-5 rounded-2xl border text-left transition-all cursor-pointer relative flex items-start gap-4 ${prType === 'trade'
                            ? 'border-indigo-600 bg-gradient-to-br from-indigo-50/80 to-indigo-50/20 ring-2 ring-indigo-600/20 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 opacity-80'
                            }`}
                    >
                        <div className='flex flex-row gap-4 items-center w-full'>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${prType === 'trade' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'
                                }`}>
                                <Store size={24} />
                            </div>
                            <div className="flex flex-row items-center justify-between w-full">
                                <span className="font-bold text-slate-900 text-xl">PR Trade</span>
                                {prType === 'trade' && (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white">
                                        Aktif
                                    </span>
                                )}
                            </div>
                        </div>
                    </button>
                </div>
            </div>

            {/* CONDITIONAL FORM CONTENT */}
            {prType === 'trade' ? (
                <PRTradeDummyForm user={user} onBack={() => navigate('/pr-non-trade')} />
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* 1. REQUESTOR INFORMATION CARD */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2.5 text-slate-800 font-bold text-base">
                                <User size={20} className="text-blue-600" />
                                <span>Requestor Information</span>
                            </div>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Transaction ID */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Transaction ID
                                </label>
                                <input
                                    type="text"
                                    value={transactionId || '(Otomatis saat disimpan)'}
                                    readOnly
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-700 shadow-xs cursor-default select-all"
                                />
                            </div>

                            {/* Transaction Date */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Transaction Date
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                    <input
                                        type="text"
                                        value={transactionDate}
                                        readOnly
                                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-xs cursor-default"
                                    />
                                </div>
                            </div>

                            {/* Requestor Name */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Requestor Name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                    <input
                                        type="text"
                                        value={requestorName}
                                        readOnly
                                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-xs cursor-default"
                                    />
                                </div>
                            </div>

                            {/* Requester Department */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Requester Department
                                </label>
                                <div className="relative">
                                    <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                    <input
                                        type="text"
                                        value={requesterDepartment || '-'}
                                        readOnly
                                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-xs cursor-default"
                                    />
                                </div>
                            </div>

                            {/* Requester Company */}
                            <div className="md:col-span-2 lg:col-span-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Requester Company
                                </label>
                                <div className="relative">
                                    <Landmark className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                    <input
                                        type="text"
                                        value={requesterCompany || '-'}
                                        readOnly
                                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-xs cursor-default"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. GENERAL DATA CARD */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2.5 text-slate-800 font-bold text-base">
                                <Layers size={20} className="text-blue-600" />
                                <span>General Data</span>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Purpose */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Purpose <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    rows={3}
                                    required
                                    placeholder="Jelaskan tujuan pengajuan PR Non-Trade ini secara singkat dan jelas..."
                                    value={purpose}
                                    onChange={(e) => setPurpose(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors placeholder:text-slate-400 shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    CAR / TBR No
                                </label>
                                <input
                                    type="text"
                                    placeholder="Masukkan CAR/TBR No..."
                                    value={carTbrNo}
                                    onChange={(e) => setCarTbrNo(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
                                />
                            </div>

                            {/* Radio Selection Group Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Goods / Service Type */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <label className="block text-sm font-bold text-slate-800 mb-3">
                                        Goods / Service Type
                                    </label>
                                    <div className="space-y-2.5">
                                        <label className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="goodsServiceType"
                                                value="lumpsum"
                                                checked={goodsServiceType === 'lumpsum'}
                                                onChange={() => setGoodsServiceType('lumpsum')}
                                                className="w-4 h-4 text-blue-600 focus:ring-blue-600 border-slate-300"
                                            />
                                            <span>Lumpsum</span>
                                        </label>
                                        <label className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="goodsServiceType"
                                                value="not_lumpsum"
                                                checked={goodsServiceType === 'not_lumpsum'}
                                                onChange={() => setGoodsServiceType('not_lumpsum')}
                                                className="w-4 h-4 text-blue-600 focus:ring-blue-600 border-slate-300"
                                            />
                                            <span>Not Lumpsum</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Purchase Type */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <label className="block text-sm font-bold text-slate-800 mb-3">
                                        Purchase Type <span className="text-red-500">*</span>
                                    </label>
                                    <div className="space-y-2.5">
                                        <label className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="purchaseType"
                                                value="non_asset"
                                                checked={purchaseType === 'non_asset'}
                                                onChange={() => setPurchaseType('non_asset')}
                                                className="w-4 h-4 text-blue-600 focus:ring-blue-600 border-slate-300"
                                            />
                                            <div>
                                                <span className="font-semibold block">Non Asset</span>
                                            </div>
                                        </label>
                                        <label className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="purchaseType"
                                                required
                                                value="asset"
                                                checked={purchaseType === 'asset'}
                                                onChange={() => setPurchaseType('asset')}
                                                className="w-4 h-4 text-blue-600 focus:ring-blue-600 border-slate-300"
                                            />
                                            <div>
                                                <span className="font-semibold block">Asset <span className="text-red-500">*</span></span>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* DYNAMIC ASSET SECTION: HIDE INSTEAD OF DISABLED */}
                            {purchaseType === 'asset' && (
                                <div className="p-5 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-4 animate-fade-in">

                                    {/* Asset Type Selector */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                            Asset Type <span className="text-red-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                                            <label
                                                onClick={() => setAssetType('non_wbs')}
                                                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${assetType === 'non_wbs'
                                                    ? 'border-blue-600 bg-white ring-2 ring-blue-600/20 shadow-xs'
                                                    : 'border-slate-200 bg-white/70 hover:bg-white'
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="assetType"
                                                    value="non_wbs"
                                                    checked={assetType === 'non_wbs'}
                                                    onChange={() => setAssetType('non_wbs')}
                                                    className="w-4 h-4 text-blue-600 focus:ring-blue-600"
                                                />
                                                <div>
                                                    <span className="font-semibold text-sm text-slate-900 block">Non WBS</span>
                                                </div>
                                            </label>

                                            <label
                                                onClick={() => setAssetType('wbs')}
                                                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${assetType === 'wbs'
                                                    ? 'border-blue-600 bg-white ring-2 ring-blue-600/20 shadow-xs'
                                                    : 'border-slate-200 bg-white/70 hover:bg-white'
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="assetType"
                                                    value="wbs"
                                                    checked={assetType === 'wbs'}
                                                    onChange={() => setAssetType('wbs')}
                                                    className="w-4 h-4 text-blue-600 focus:ring-blue-600"
                                                />
                                                <div>
                                                    <span className="font-semibold text-sm text-slate-900 block">WBS</span>
                                                </div>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Dynamic Asset Fields: HIDE NOT DISABLED */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                        {/* Asset No: ONLY shown if assetType === 'non_wbs', otherwise HIDDEN */}
                                        {assetType === 'non_wbs' && (
                                            <div className="animate-fade-in">
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                    Asset No <span className="text-red-500">*</span>
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder="Cari / masukkan Asset No..."
                                                        value={assetNo}
                                                        onChange={(e) => setAssetNo(e.target.value)}
                                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setModalType('asset')}
                                                        className="px-3.5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 border border-transparent rounded-xl transition-colors cursor-pointer shrink-0 font-medium text-xs flex items-center gap-1.5 shadow-xs"
                                                        title="Cari Master Asset"
                                                    >
                                                        <Search size={16} />
                                                        <span>Cari</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* WBS No: ONLY shown if assetType === 'wbs', otherwise HIDDEN */}
                                        {assetType === 'wbs' && (
                                            <div className="animate-fade-in">
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                    WBS No <span className="text-red-500">*</span>
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder="Cari / masukkan WBS No..."
                                                        value={wbsNo}
                                                        onChange={(e) => setWbsNo(e.target.value)}
                                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm font-mono"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setModalType('wbs')}
                                                        className="px-3.5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 border border-transparent rounded-xl transition-colors cursor-pointer shrink-0 font-medium text-xs flex items-center gap-1.5 shadow-xs"
                                                        title="Cari Master WBS"
                                                    >
                                                        <Search size={16} />
                                                        <span>Cari</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Equipment Name for Asset */}
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                Equipment Name <span className="text-red-500">*</span>
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Cari / nama peralatan aset..."
                                                    required
                                                    value={equipmentName}
                                                    onChange={(e) => setEquipmentName(e.target.value)}
                                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setModalType('equipment')}
                                                    className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
                                                    title="Cari Master Equipment"
                                                >
                                                    <Search size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Operational Equipment */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">

                                {purchaseType === 'non_asset' && (
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Equipment / Nama Peralatan Operasional
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Nama peralatan operasional (opsional)..."
                                                value={equipmentName}
                                                onChange={(e) => setEquipmentName(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setModalType('equipment')}
                                                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
                                                title="Cari Master Equipment"
                                            >
                                                <Search size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 3. DETAIL ITEMS CARD */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2.5 text-slate-800 font-bold text-base">
                                <Package size={20} className="text-blue-600" />
                                <span>Detail Items</span>
                                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-semibold">
                                    {items.length} item
                                </span>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">

                            {/* Item Input Form Box */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                                <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Plus size={18} className="text-blue-600" />
                                    <span>{editingItemIndex !== null ? 'Edit Item Line' : 'Tambah Item Baru'}</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                    {/* Goods Code */}
                                    <div className="md:col-span-3">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                            Goods Code <span className="text-red-500">*</span>
                                        </label>
                                        <div className="flex gap-1.5">
                                            <input
                                                type="text"
                                                placeholder="Kode barang..."
                                                value={itemForm.goods_code}
                                                onChange={(e) => setItemForm({ ...itemForm, goods_code: e.target.value })}
                                                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setModalType('goods')}
                                                className="px-3 py-2 bg-blue-100 text-blue-800 hover:bg-blue-200 rounded-xl text-sm font-medium transition-colors cursor-pointer shrink-0"
                                                title="Cari Master Goods"
                                            >
                                                <Search size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Goods Name */}
                                    <div className="md:col-span-4">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                            Goods Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Nama barang / deskripsi..."
                                            value={itemForm.goods_name}
                                            onChange={(e) => setItemForm({ ...itemForm, goods_name: e.target.value })}
                                            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
                                        />
                                    </div>

                                    {/* Unit */}
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                            Unit
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="PCS, BOX..."
                                            value={itemForm.unit}
                                            onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                                            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
                                        />
                                    </div>

                                    {/* Quantity */}
                                    <div className="md:col-span-3">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                            Quantity
                                        </label>
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="any"
                                            value={itemForm.quantity}
                                            onChange={(e) => setItemForm({ ...itemForm, quantity: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
                                        />
                                    </div>

                                    {/* Remark */}
                                    <div className="md:col-span-9">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                            Remark (Catatan Item)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Catatan spesifikasi/kebutuhan item..."
                                            value={itemForm.remark}
                                            onChange={(e) => setItemForm({ ...itemForm, remark: e.target.value })}
                                            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
                                        />
                                    </div>

                                    {/* Item Form Buttons */}
                                    <div className="md:col-span-3 flex items-end gap-2">
                                        <button
                                            type="button"
                                            onClick={handleAddItem}
                                            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors cursor-pointer"
                                        >
                                            <Save size={16} />
                                            <span>{editingItemIndex !== null ? 'Simpan Item' : 'Tambah Item'}</span>
                                        </button>
                                        {editingItemIndex !== null && (
                                            <button
                                                type="button"
                                                onClick={handleCancelItemEdit}
                                                className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                <table className="w-full text-left text-sm text-slate-700">
                                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase text-xs tracking-wider">
                                        <tr>
                                            <th className="py-3.5 px-4 w-12 text-center">#</th>
                                            <th className="py-3.5 px-4">Goods Code</th>
                                            <th className="py-3.5 px-4">Goods Name</th>
                                            <th className="py-3.5 px-4 text-center">Unit</th>
                                            <th className="py-3.5 px-4 text-right">Quantity</th>
                                            <th className="py-3.5 px-4">Remark</th>
                                            <th className="py-3.5 px-4 text-center w-28">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {items.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-8 text-center text-slate-500 text-sm">
                                                    Belum ada item ditambahkan. Gunakan form di atas untuk menambah item.
                                                </td>
                                            </tr>
                                        ) : (
                                            items.map((it, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="py-3.5 px-4 text-center font-mono text-slate-500 text-sm">{idx + 1}</td>
                                                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700 text-sm">{it.goods_code}</td>
                                                    <td className="py-3.5 px-4 font-medium text-slate-800 text-sm">{it.goods_name}</td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        <span className="px-2.5 py-1 rounded bg-slate-100 font-medium text-xs text-slate-700">
                                                            {it.unit}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-semibold text-slate-800 text-sm">{it.quantity}</td>
                                                    <td className="py-3.5 px-4 text-slate-600 text-sm max-w-xs truncate">{it.remark || '-'}</td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEditItem(idx)}
                                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Edit item"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteItem(idx)}
                                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Hapus item"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                        </div>
                    </div>

                    {/* 4. SUBMISSION REMARK CARD */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
                        <label className="block text-sm font-bold text-slate-800">
                            Submission Remark (Catatan Pengajuan)
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Tambahkan catatan khusus untuk verifikator/approver jika diperlukan..."
                            value={submissionRemark}
                            onChange={(e) => setSubmissionRemark(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-slate-400 shadow-sm"
                        />
                    </div>

                    {/* 5. FORM ACTION BUTTONS */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-5 flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-4 z-20">
                        <div className="text-sm text-slate-600 flex items-center gap-2">
                            <Info size={18} className="text-blue-600 shrink-0" />
                            <span>Form ini dapat disimpan sebagai Draft terlebih dahulu sebelum disubmit ke workflow approval.</span>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto shrink-0">
                            {/* Submit & Save as Draft group */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                {/* Save as Draft Button */}
                                <button
                                    type="button"
                                    onClick={handleSaveDraft}
                                    disabled={savingDraft || submitting}
                                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-sm font-bold shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
                                >
                                    {savingDraft ? (
                                        <><Loader2 size={18} className="animate-spin" /> Saving Draft...</>
                                    ) : (
                                        <><Save size={18} /> Save as Draft</>
                                    )}
                                </button>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={submitting || savingDraft}
                                    className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition-all cursor-pointer"
                                >
                                    {submitting ? (
                                        <><Loader2 size={18} className="animate-spin" /> Submitting...</>
                                    ) : (
                                        <><Send size={18} /> Submit</>
                                    )}
                                </button>
                            </div>

                            {/* Cancel Button - full width on mobile, auto on desktop */}
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors cursor-pointer text-center"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>

                </form>
            )}

            {/* Master Data Search Modal */}
            <MasterSearchModal
                isOpen={modalType !== null}
                title={getModalTitle()}
                onClose={() => setModalType(null)}
                onSelect={handleSelectMasterItem}
                fetchData={getMasterFetchFn()}
            />
        </div>
    );
};
