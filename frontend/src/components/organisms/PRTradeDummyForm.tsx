import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import {
    User, Building, Landmark, Calendar,
    Plus, Trash2, Edit2, Save, X, Search, Send, Info, Package, Layers
} from 'lucide-react';
import { MasterSearchModal } from './MasterSearchModal';
import { MasterItem } from '../../services/prNonTradeService';

interface PRTradeItemDummy {
    sku_code: string;
    product_name: string;
    category: string;
    unit: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    remark: string;
}

interface PRTradeDummyFormProps {
    user: any;
    onBack?: () => void;
}

// Dummy master data for suppliers
const DUMMY_SUPPLIERS: MasterItem[] = [
    { id: 1, code: 'VND-001', name: 'PT Indofood CBP Sukses Makmur Tbk', description: 'Distributor resmi produk mie instan & bumbu', category: 'Food & Beverage', project_name: 'TOP: 30 Hari' },
    { id: 2, code: 'VND-002', name: 'PT Unilever Indonesia Tbk', description: 'Pemasok produk perawatan diri & home care', category: 'Personal & Home Care', project_name: 'TOP: 45 Hari' },
    { id: 3, code: 'VND-003', name: 'PT Wings Surya', description: 'Pemasok deterjen, sabun, dan makanan kemasan', category: 'Consumer Goods', project_name: 'TOP: 30 Hari' },
    { id: 4, code: 'VND-004', name: 'PT Mayora Indah Tbk', description: 'Produsen biskuit, kopi & kembang gula', category: 'Confectionery', project_name: 'TOP: 60 Hari' },
    { id: 5, code: 'VND-005', name: 'PT Danone Aqua Indonesia', description: 'Pemasok air mineral & nutrisi higienis', category: 'Beverage', project_name: 'TOP: 14 Hari' },
    { id: 6, code: 'VND-006', name: 'PT Frisian Flag Indonesia', description: 'Pemasok produk susu olahan', category: 'Dairy', project_name: 'TOP: 30 Hari' }
];

// Dummy master data for trade products (SKUs)
const DUMMY_TRADE_PRODUCTS: MasterItem[] = [
    { id: 101, code: 'SKU-ICBP-01', name: 'Indomie Goreng Spesial 85g', description: 'Mie Instan Goreng per Karton (40 Pcs)', unit: 'KARTON', category: 'Food', project_name: 'Min. Exp: 8 bln' },
    { id: 102, code: 'SKU-ICBP-02', name: 'Indomie Kuah Ayam Bawang 69g', description: 'Mie Instan Kuah per Karton (40 Pcs)', unit: 'KARTON', category: 'Food', project_name: 'Min. Exp: 8 bln' },
    { id: 103, code: 'SKU-UNL-01', name: 'Bango Kecap Manis Pouch 550ml', description: 'Kecap Manis per Karton (12 Pcs)', unit: 'KARTON', category: 'Condiment', project_name: 'Min. Exp: 12 bln' },
    { id: 104, code: 'SKU-UNL-02', name: 'Sunlight Jeruk Nipis 700ml', description: 'Sabun Cuci Piring per Karton (12 Pcs)', unit: 'KARTON', category: 'Home Care', project_name: 'Min. Exp: 18 bln' },
    { id: 105, code: 'SKU-MYR-01', name: 'Roma Kelapa Biscuit 300g', description: 'Biskuit Kelapa per Karton (20 Pack)', unit: 'KARTON', category: 'Snack', project_name: 'Min. Exp: 10 bln' },
    { id: 106, code: 'SKU-MYR-02', name: 'Torabika Cappuccino Bag (20x25g)', description: 'Kopi Instan per Karton (12 Bag)', unit: 'KARTON', category: 'Beverage', project_name: 'Min. Exp: 12 bln' },
    { id: 107, code: 'SKU-WNG-01', name: 'Daia Deterjen Softener 850g', description: 'Deterjen Bubuk per Karton (12 Bag)', unit: 'KARTON', category: 'Laundry', project_name: 'Min. Exp: 24 bln' },
    { id: 108, code: 'SKU-DAN-01', name: 'AQUA Air Mineral 600ml', description: 'Air Mineral Botol per Karton (24 Btl)', unit: 'KARTON', category: 'Beverage', project_name: 'Min. Exp: 12 bln' }
];

export const PRTradeDummyForm: React.FC<PRTradeDummyFormProps> = ({ user, onBack }) => {
    const toast = useToast();

    const todayDate = new Date().toISOString().split('T')[0];

    // Dummy preview transaction ID
    const [transactionId] = useState('');
    const [transactionDate] = useState(todayDate);
    const [requestorName] = useState(user?.name || user?.first_name || user?.username || 'Commercial Purchasing Specialist');
    const [requesterDepartment] = useState(user?.department || 'Commercial & Trade Procurement');
    const [requesterCompany] = useState((user as any)?.company || '');

    // Trade General Information
    const [purpose, setPurpose] = useState('Pemesanan stok barang dagang (trade merchandise) untuk pemenuhan target buffer distribution center.');

    const [submissionRemark, setSubmissionRemark] = useState('');

    // Dummy Items List
    const [items, setItems] = useState<PRTradeItemDummy[]>([
        {
            sku_code: 'SKU-ICBP-01',
            product_name: 'Indomie Goreng Spesial 85g',
            category: 'Food',
            unit: 'KARTON',
            quantity: 120,
            unit_price: 116500,
            discount_percent: 2.5,
            remark: 'Expired date minimal 8 bulan ke depan'
        },
        {
            sku_code: 'SKU-UNL-01',
            product_name: 'Bango Kecap Manis Pouch 550ml',
            category: 'Condiment',
            unit: 'KARTON',
            quantity: 60,
            unit_price: 242000,
            discount_percent: 0,
            remark: 'Prioritaskan batch produksi terbaru'
        },
        {
            sku_code: 'SKU-MYR-01',
            product_name: 'Roma Kelapa Biscuit 300g',
            category: 'Snack',
            unit: 'KARTON',
            quantity: 80,
            unit_price: 132000,
            discount_percent: 5,
            remark: 'Kemasan karton tidak penyok'
        }
    ]);

    // Item form state
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [itemForm, setItemForm] = useState<PRTradeItemDummy>({
        sku_code: '',
        product_name: '',
        category: 'Food',
        unit: 'KARTON',
        quantity: 10,
        unit_price: 100000,
        discount_percent: 0,
        remark: ''
    });

    // Modal state
    const [modalType, setModalType] = useState<'supplier' | 'product' | null>(null);

    // Item Handlers
    const handleSaveItem = () => {
        if (!itemForm.sku_code.trim() || !itemForm.product_name.trim()) {
            toast.error('Kode SKU dan Nama Produk wajib diisi!');
            return;
        }
        if (itemForm.quantity <= 0) {
            toast.error('Quantity harus lebih dari 0!');
            return;
        }

        if (editingIndex !== null) {
            const updated = [...items];
            updated[editingIndex] = { ...itemForm };
            setItems(updated);
            setEditingIndex(null);
            toast.success('Item produk dagang berhasil diperbarui.');
        } else {
            setItems([...items, { ...itemForm }]);
            toast.success('Item produk dagang berhasil ditambahkan.');
        }

        // Reset
        setItemForm({
            sku_code: '',
            product_name: '',
            category: 'Food',
            unit: 'KARTON',
            quantity: 10,
            unit_price: 100000,
            discount_percent: 0,
            remark: ''
        });
    };

    const handleEditItem = (idx: number) => {
        setEditingIndex(idx);
        setItemForm({ ...items[idx] });
    };

    const handleDeleteItem = (idx: number) => {
        setItems(items.filter((_, i) => i !== idx));
        if (editingIndex === idx) {
            setEditingIndex(null);
            setItemForm({
                sku_code: '',
                product_name: '',
                category: 'Food',
                unit: 'KARTON',
                quantity: 10,
                unit_price: 100000,
                discount_percent: 0,
                remark: ''
            });
        }
        toast.info('Item produk dihapus.');
    };

    const handleCancelEdit = () => {
        setEditingIndex(null);
        setItemForm({
            sku_code: '',
            product_name: '',
            category: 'Food',
            unit: 'KARTON',
            quantity: 10,
            unit_price: 100000,
            discount_percent: 0,
            remark: ''
        });
    };

    // Modal select
    const handleSelectMaster = (item: MasterItem) => {
        if (modalType === 'supplier') {
            toast.info(`Supplier dipilih: ${item.name}`);
        } else if (modalType === 'product') {
            setItemForm((prev) => ({
                ...prev,
                sku_code: item.code,
                product_name: item.name || '',
                unit: item.unit || 'KARTON',
                category: item.category || 'General',
                remark: item.project_name || prev.remark
            }));
            toast.info(`Produk dipilih: ${item.code} - ${item.name}`);
        }
    };

    const searchSupplierFn = async (query: string) => {
        const q = query.toLowerCase();
        return DUMMY_SUPPLIERS.filter(s =>
            s.code.toLowerCase().includes(q) ||
            (s.name || '').toLowerCase().includes(q) ||
            (s.category || '').toLowerCase().includes(q)
        );
    };

    const searchProductFn = async (query: string) => {
        const q = query.toLowerCase();
        return DUMMY_TRADE_PRODUCTS.filter(p =>
            p.code.toLowerCase().includes(q) ||
            (p.name || '').toLowerCase().includes(q) ||
            (p.category || '').toLowerCase().includes(q)
        );
    };

    const handleSaveDraftSimulated = () => {
        toast.success('Draft PR Trade berhasil disimpan sebagai simulasi (dummy).');
    };

    const handleSubmitSimulated = (e: React.FormEvent) => {
        e.preventDefault();
        if (items.length === 0) {
            toast.error('Tambahkan minimal 1 item barang dagang!');
            return;
        }
    };

    return (
        <div className="space-y-6">

            <form onSubmit={handleSubmitSimulated} className="space-y-6">

                {/* 1. REQUESTOR INFORMATION */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-slate-800 font-bold text-base">
                            <User size={19} className="text-indigo-600" />
                            <span>Requestor Information</span>
                        </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {/* Transaction ID */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Transaction ID
                            </label>
                            <input
                                type="text"
                                value={transactionId || '(Otomatis saat disimpan)'}
                                readOnly
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-indigo-700 shadow-xs cursor-default select-all"
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
                                Department
                            </label>
                            <div className="relative">
                                <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                <input
                                    type="text"
                                    value={requesterDepartment}
                                    readOnly
                                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-xs cursor-default"
                                />
                            </div>
                        </div>

                        {/* Requester Company */}
                        <div className="md:col-span-2 lg:col-span-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Company / Entity
                            </label>
                            <div className="relative">
                                <Landmark className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                <input
                                    type="text"
                                    value={requesterCompany}
                                    readOnly
                                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-xs cursor-default"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. TRADE GENERAL DATA */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-slate-800 font-bold text-base">
                            <Layers size={19} className="text-indigo-600" />
                            <span>General Data</span>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">

                        {/* Purpose / Catatan Justifikasi */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Purpose <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                rows={2}
                                required
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value)}
                                placeholder="Jelaskan kebutuhan pembelian barang dagangan ini..."
                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 shadow-sm"
                            />
                        </div>

                    </div>
                </div>

                {/* 3. DETAIL ITEMS (BARANG DAGANG) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-slate-800 font-bold text-base">
                            <Package size={19} className="text-indigo-600" />
                            <span>Goods Detail</span>
                            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                                {items.length} SKU
                            </span>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">

                        {/* Add / Edit Item Form Box */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                            <div className="text-sm font-bold text-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Plus size={18} className="text-indigo-600" />
                                    <span>SKU Detail Information</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setModalType('product')}
                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1.5"
                                >
                                    <Search size={14} />
                                    <span>Pilih dari Master Katalog Dagang</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                {/* SKU Code */}
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Kode SKU / Barcode <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Contoh: SKU-ICBP-01"
                                        value={itemForm.sku_code}
                                        onChange={(e) => setItemForm({ ...itemForm, sku_code: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-600 shadow-sm"
                                    />
                                </div>

                                {/* Product Name */}
                                <div className="md:col-span-4">
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Nama Produk Dagang <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Nama produk dagang..."
                                        value={itemForm.product_name}
                                        onChange={(e) => setItemForm({ ...itemForm, product_name: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 shadow-sm"
                                    />
                                </div>

                                {/* Unit */}
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Satuan (UOM)
                                    </label>
                                    <select
                                        value={itemForm.unit}
                                        onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 shadow-sm"
                                    >
                                        <option value="KARTON">KARTON</option>
                                        <option value="DUS">DUS</option>
                                        <option value="LUSIN">LUSIN</option>
                                        <option value="PACK">PACK</option>
                                        <option value="PCS">PCS</option>
                                        <option value="BOX">BOX</option>
                                    </select>
                                </div>

                                {/* Quantity */}
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Qty Order <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={itemForm.quantity}
                                        onChange={(e) => setItemForm({ ...itemForm, quantity: Math.max(1, parseInt(e.target.value) || 0) })}
                                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 shadow-sm"
                                    />
                                </div>

                                {/* Unit Price */}
                                <div className="md:col-span-4">
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Price (Rp) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="500"
                                        value={itemForm.unit_price}
                                        onChange={(e) => setItemForm({ ...itemForm, unit_price: Math.max(0, parseFloat(e.target.value) || 0) })}
                                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 shadow-sm"
                                    />
                                </div>

                                {/* Buttons */}
                                <div className="md:col-span-2 flex items-end gap-2">
                                    <button
                                        type="button"
                                        onClick={handleSaveItem}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors cursor-pointer"
                                    >
                                        <Save size={16} />
                                        <span>{editingIndex !== null ? 'Simpan' : 'Tambah'}</span>
                                    </button>
                                    {editingIndex !== null && (
                                        <button
                                            type="button"
                                            onClick={handleCancelEdit}
                                            className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm transition-colors cursor-pointer"
                                            title="Batal Edit"
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
                                        <th className="py-3 px-3.5 w-12 text-center">#</th>
                                        <th className="py-3 px-3.5">SKU & Deskripsi Produk</th>
                                        <th className="py-3 px-3.5 text-center">Satuan</th>
                                        <th className="py-3 px-3.5 text-right">Qty</th>
                                        <th className="py-3 px-3.5 text-right">Harga Satuan (Rp)</th>
                                        <th className="py-3 px-3.5">Catatan</th>
                                        <th className="py-3 px-3.5 text-center w-24">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-8 text-center text-slate-400">
                                                Belum ada item barang dagang. Tambahkan item di atas.
                                            </td>
                                        </tr>
                                    ) : (
                                        items.map((it, idx) => {
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="py-3 px-3.5 text-center font-mono text-slate-400 text-xs">{idx + 1}</td>
                                                    <td className="py-3 px-3.5">
                                                        <div className="font-mono font-bold text-indigo-700 text-xs">{it.sku_code}</div>
                                                        <div className="font-semibold text-slate-800 text-sm">{it.product_name}</div>
                                                    </td>
                                                    <td className="py-3 px-3.5 text-center">
                                                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-xs">
                                                            {it.unit}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3.5 text-right font-bold text-slate-800">{it.quantity.toLocaleString('id-ID')}</td>
                                                    <td className="py-3 px-3.5 text-right font-mono text-slate-700">Rp {it.unit_price.toLocaleString('id-ID')}</td>
                                                    <td className="py-3 px-3.5 text-xs text-slate-500 max-w-xs truncate">{it.remark || '-'}</td>
                                                    <td className="py-3 px-3.5 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEditItem(idx)}
                                                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                                                title="Edit"
                                                            >
                                                                <Edit2 size={15} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteItem(idx)}
                                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                                title="Hapus"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                    </div>
                </div>

                {/* 4. SUBMISSION REMARK */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
                    <label className="block text-sm font-bold text-slate-800">
                        Submission Remark (Catatan Pengajuan Dagang)
                    </label>
                    <textarea
                        rows={2}
                        placeholder="Tambahkan catatan khusus untuk verifikator/approver jika diperlukan..."
                        value={submissionRemark}
                        onChange={(e) => setSubmissionRemark(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all shadow-sm"
                    />
                </div>

                {/* 5. ACTION BUTTONS */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-5 flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-4 z-20">
                    <div className="text-sm text-slate-600 flex items-center gap-2">
                        <Info size={18} className="text-indigo-600 shrink-0" />
                        <span>Form PR Trade saat ini dalam mode dummy untuk validasi konsep UX & UI dinamis.</span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto shrink-0">
                        {/* Save as Draft Simulated */}
                        <button
                            type="button"
                            onClick={handleSaveDraftSimulated}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-sm font-bold shadow-sm transition-colors cursor-pointer"
                        >
                            <Save size={18} />
                            <span>Simpan Draft Trade</span>
                        </button>

                        {/* Submit Button Simulated */}
                        <button
                            type="submit"
                            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                        >
                            <Send size={18} />
                            <span>Submit PR Trade</span>
                        </button>

                        {/* Cancel Button */}
                        {onBack && (
                            <button
                                type="button"
                                onClick={onBack}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors cursor-pointer text-center"
                            >
                                Kembali
                            </button>
                        )}
                    </div>
                </div>

            </form>

            {/* Master Search Modal */}
            <MasterSearchModal
                isOpen={modalType !== null}
                title={modalType === 'supplier' ? 'Pencarian Master Supplier Dagang' : 'Pencarian Master Produk Dagang (SKU)'}
                onClose={() => setModalType(null)}
                onSelect={handleSelectMaster}
                fetchData={modalType === 'supplier' ? searchSupplierFn : searchProductFn}
            />
        </div>
    );
};
