import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Inbox,
    Filter,
    ArrowUpRight,
    ShoppingCart,
    Wallet,
    Users,
    Eye,
    Lock,
    RotateCw,
    Search,
    X,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
} from 'lucide-react';
import api from '@/services/api';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Pagination } from '@/components/atoms/Pagination';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/atoms/Table';
import { formatDate } from '@/lib/utils';
import { Link } from 'react-router-dom';

export const InboxPage = () => {
    const [activeTab, setActiveTab] = useState<'inbox' | 'watching'>('inbox');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Filter states
    const [showFilters, setShowFilters] = useState(false);
    const [search, setSearch] = useState('');
    const [moduleFilter, setModuleFilter] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [purchaseTypeFilter, setPurchaseTypeFilter] = useState('');
    const [assetTypeFilter, setAssetTypeFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Sort state
    const [ordering, setOrdering] = useState('-created_at');

    const handleTabChange = (tab: 'inbox' | 'watching') => {
        setActiveTab(tab);
        setPage(1);
        if (tab === 'inbox') {
            setStatusFilter('');
        }
    };

    // Fetch dynamic modules list
    const { data: moduleData } = useQuery<any>({
        queryKey: ['admin-modules-inbox'],
        queryFn: () => api.get('/admin/modules', { params: { page_size: 100 } }),
        staleTime: 5 * 60 * 1000,
    });

    // Fetch dynamic departments list
    const { data: deptData } = useQuery<any>({
        queryKey: ['admin-departments-inbox'],
        queryFn: () => api.get('/admin/departments', { params: { page_size: 100 } }),
        staleTime: 5 * 60 * 1000,
    });

    const dynamicModules = (moduleData?.results || []).map((m: any) => ({
        value: m.code,
        label: m.name,
    }));

    const dynamicDepts = Array.from(
        new Set(
            ((deptData?.results || deptData || []) as any[])
                .map((d: any) => d.name)
                .filter(Boolean)
        )
    ).map((name: string) => ({ value: name, label: name }));

    const departmentOptions = [
        { value: '', label: 'All Departments' },
        ...dynamicDepts,
    ];

    const purchaseTypeOptions = [
        { value: '', label: 'All Purchase Types' },
        { value: 'asset', label: 'Asset' },
        { value: 'non_asset', label: 'Non Asset' },
    ];

    const assetTypeOptions = [
        { value: '', label: 'All Asset Types' },
        { value: 'non_wbs', label: 'Non WBS' },
        { value: 'wbs', label: 'WBS' },
    ];

    const moduleOptions = [
        { value: '', label: 'All Modules' },
        ...(dynamicModules.length > 0
            ? dynamicModules
            : [
                { value: 'PR_NON_TRADE', label: 'PR Non-Trade' },
                { value: 'EORDER', label: 'E-Order' },
                { value: 'FINANCE', label: 'Finance' },
                { value: 'HR', label: 'HR' },
            ]),
    ];

    const statusOptions = [
        { value: '', label: 'All Status' },
        { value: 'IN_PROGRESS', label: 'In Progress' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'REJECTED', label: 'Rejected' },
        { value: 'REVISED', label: 'Revised' },
    ];

    const sortOptions = [
        { value: '-created_at', label: 'Date: Newest' },
        { value: 'created_at', label: 'Date: Oldest' },
        { value: 'department', label: 'Department: A - Z' },
        { value: '-department', label: 'Department: Z - A' },
        { value: 'purchase_type', label: 'Purchase Type: A - Z' },
        { value: '-purchase_type', label: 'Purchase Type: Z - A' },
        { value: 'asset_type', label: 'Asset Type: A - Z' },
        { value: '-asset_type', label: 'Asset Type: Z - A' },
        { value: 'reference_id', label: 'Ref Number: A - Z' },
        { value: '-reference_id', label: 'Ref Number: Z - A' },
        { value: 'updated_at', label: 'Last Updated: Oldest' },
        { value: '-updated_at', label: 'Last Updated: Newest' },
    ];

    const activeFiltersCount = [
        search,
        moduleFilter,
        departmentFilter,
        purchaseTypeFilter,
        assetTypeFilter,
        priorityFilter,
        (activeTab === 'watching' ? statusFilter : ''),
        startDate,
        endDate,
    ].filter(Boolean).length;

    const handleResetFilters = () => {
        setSearch('');
        setModuleFilter('');
        setDepartmentFilter('');
        setPurchaseTypeFilter('');
        setAssetTypeFilter('');
        setPriorityFilter('');
        setStatusFilter('');
        setStartDate('');
        setEndDate('');
        setPage(1);
    };

    const handleSort = (field: string) => {
        setPage(1);
        if (ordering === field) {
            setOrdering(`-${field}`);
        } else if (ordering === `-${field}`) {
            setOrdering('-created_at');
        } else {
            setOrdering(field);
        }
    };

    const renderSortIndicator = (field: string) => {
        if (ordering === field) {
            return <ArrowUp size={13} className="text-blue-600 ml-1 inline" />;
        }
        if (ordering === `-${field}`) {
            return <ArrowDown size={13} className="text-blue-600 ml-1 inline" />;
        }
        return <ArrowUpDown size={13} className="text-slate-400 opacity-40 group-hover:opacity-100 ml-1 inline transition-opacity" />;
    };

    const { data: inbox, isLoading } = useQuery<any>({
        queryKey: ['inbox', activeTab, page, pageSize, search, moduleFilter, departmentFilter, purchaseTypeFilter, assetTypeFilter, priorityFilter, statusFilter, startDate, endDate, ordering],
        queryFn: () => api.get('/inbox', {
            params: {
                tab: activeTab,
                page,
                page_size: pageSize,
                search: search || undefined,
                module: moduleFilter || undefined,
                department: departmentFilter || undefined,
                purchase_type: purchaseTypeFilter || undefined,
                asset_type: assetTypeFilter || undefined,
                priority: priorityFilter || undefined,
                status: (activeTab === 'watching' && statusFilter) ? statusFilter : undefined,
                start_date: startDate || undefined,
                end_date: endDate || undefined,
                ordering: ordering || undefined,
            }
        }),
    });

    const getModuleIcon = (code: string) => {
        switch (code) {
            case 'PR_NON_TRADE': return <ShoppingCart size={16} className="text-amber-600" />;
            case 'EORDER': return <ShoppingCart size={16} className="text-blue-600" />;
            case 'FINANCE': return <Wallet size={16} className="text-emerald-600" />;
            case 'HR': return <Users size={16} className="text-purple-600" />;
            default: return <Inbox size={16} className="text-slate-600" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED': return <Badge variant="success">Approved</Badge>;
            case 'REJECTED': return <Badge variant="error">Rejected</Badge>;
            case 'IN_PROGRESS': return <Badge variant="info">In Progress</Badge>;
            case 'REVISED': return <Badge variant="warning">Revised</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex border-b border-slate-100">
                <button
                    onClick={() => handleTabChange('inbox')}
                    className={`px-6 py-4 text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'inbox'
                        ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    <Inbox size={18} />
                    Inbox
                </button>
                <button
                    onClick={() => handleTabChange('watching')}
                    className={`px-6 py-4 text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'watching'
                        ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    <Eye size={18} />
                    Watching
                </button>
            </div>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                        {activeTab === 'inbox' ? 'Approval Inbox' : 'Watched Requests'}
                    </h1>
                    <p className="mt-1 text-slate-500">
                        {activeTab === 'inbox'
                            ? 'Review and approve tasks from all departments.'
                            : 'Monitor requests where you are added as a watcher.'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {/* Sort Dropdown */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-slate-500 hidden sm:inline">Sort by:</span>
                        <select
                            value={ordering}
                            onChange={(e) => {
                                setOrdering(e.target.value);
                                setPage(1);
                            }}
                            className="h-10 text-sm font-medium bg-white border border-slate-200 rounded-md px-3 py-2 text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer shadow-sm"
                        >
                            {sortOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Toggle Button */}
                    <Button
                        variant={showFilters || activeFiltersCount > 0 ? 'primary' : 'outline'}
                        onClick={() => setShowFilters(!showFilters)}
                        className="gap-2 transition-all"
                    >
                        <Filter size={16} />
                        Filters
                        {activeFiltersCount > 0 && (
                            <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-sm font-bold rounded-full ${showFilters || activeFiltersCount > 0 ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>
                                {activeFiltersCount}
                            </span>
                        )}
                    </Button>
                </div>
            </div>

            {/* Collapsible Filter Panel */}
            {showFilters && (
                <Card className="p-5 bg-slate-50/80 border-slate-200 transition-all">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                        {/* Search Input */}
                        <div className="sm:col-span-2 lg:col-span-2">
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Search</label>
                            <div className="relative">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        setPage(1);
                                    }}
                                    placeholder="Search, Ref Number, or Requester..."
                                    className="h-9 w-full pl-9 pr-8 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                                />
                                {search && (
                                    <button
                                        onClick={() => { setSearch(''); setPage(1); }}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Module Dropdown */}
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Module</label>
                            <select
                                value={moduleFilter}
                                onChange={(e) => {
                                    setModuleFilter(e.target.value);
                                    setPage(1);
                                }}
                                className="h-9 w-full text-sm bg-white border border-slate-200 rounded-md px-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {moduleOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Department Dropdown */}
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Department</label>
                            <select
                                value={departmentFilter}
                                onChange={(e) => {
                                    setDepartmentFilter(e.target.value);
                                    setPage(1);
                                }}
                                className="h-9 w-full text-sm bg-white border border-slate-200 rounded-md px-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {departmentOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Purchase Type Dropdown */}
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Purchase Type</label>
                            <select
                                value={purchaseTypeFilter}
                                onChange={(e) => {
                                    setPurchaseTypeFilter(e.target.value);
                                    if (e.target.value === 'non_asset') {
                                        setAssetTypeFilter('');
                                    }
                                    setPage(1);
                                }}
                                className="h-9 w-full text-sm bg-white border border-slate-200 rounded-md px-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {purchaseTypeOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Asset Type Dropdown */}
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Asset Type</label>
                            <select
                                value={assetTypeFilter}
                                onChange={(e) => {
                                    setAssetTypeFilter(e.target.value);
                                    setPage(1);
                                }}
                                className="h-9 w-full text-sm bg-white border border-slate-200 rounded-md px-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {assetTypeOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Status Dropdown (Watching Tab only) */}
                        {activeTab === 'watching' ? (
                            <div>
                                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Status</label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => {
                                        setStatusFilter(e.target.value);
                                        setPage(1);
                                    }}
                                    className="h-9 w-full text-sm bg-white border border-slate-200 rounded-md px-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {statusOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        ) : null}

                        {/* Start Date */}
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5">From Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    setPage(1);
                                }}
                                className="h-9 w-full text-sm bg-white border border-slate-200 rounded-md px-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* End Date */}
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5">To Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    setPage(1);
                                }}
                                className="h-9 w-full text-sm bg-white border border-slate-200 rounded-md px-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Filter Actions */}
                    <div className="flex justify-between items-center pt-3 border-t border-slate-200/80 mt-4">
                        <span className="text-sm text-slate-500">
                            {activeFiltersCount > 0 ? `${activeFiltersCount} filter applied` : 'No filter applied'}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleResetFilters}
                            disabled={activeFiltersCount === 0}
                            className="gap-1.5 text-sm text-slate-600 hover:text-slate-900"
                        >
                            <RotateCw size={13} />
                            Reset Filter
                        </Button>
                    </div>
                </Card>
            )}

            {/* Active Filter Chips */}
            {activeFiltersCount > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-slate-500 font-medium">Active Filter:</span>
                    {search && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            Search: "{search}"
                            <button onClick={() => { setSearch(''); setPage(1); }} className="hover:text-blue-900">
                                <X size={12} />
                            </button>
                        </span>
                    )}
                    {moduleFilter && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            Module: {moduleOptions.find((o) => o.value === moduleFilter)?.label || moduleFilter}
                            <button onClick={() => { setModuleFilter(''); setPage(1); }} className="hover:text-blue-900">
                                <X size={12} />
                            </button>
                        </span>
                    )}
                    {departmentFilter && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            Department: {departmentFilter}
                            <button onClick={() => { setDepartmentFilter(''); setPage(1); }} className="hover:text-blue-900">
                                <X size={12} />
                            </button>
                        </span>
                    )}
                    {purchaseTypeFilter && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            Purchase Type: {purchaseTypeOptions.find((o) => o.value === purchaseTypeFilter)?.label || purchaseTypeFilter}
                            <button onClick={() => { setPurchaseTypeFilter(''); setPage(1); }} className="hover:text-blue-900">
                                <X size={12} />
                            </button>
                        </span>
                    )}
                    {assetTypeFilter && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            Asset Type: {assetTypeOptions.find((o) => o.value === assetTypeFilter)?.label || assetTypeFilter}
                            <button onClick={() => { setAssetTypeFilter(''); setPage(1); }} className="hover:text-blue-900">
                                <X size={12} />
                            </button>
                        </span>
                    )}
                    {activeTab === 'watching' && statusFilter && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            Status: {statusFilter}
                            <button onClick={() => { setStatusFilter(''); setPage(1); }} className="hover:text-blue-900">
                                <X size={12} />
                            </button>
                        </span>
                    )}
                    {startDate && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            From: {startDate}
                            <button onClick={() => { setStartDate(''); setPage(1); }} className="hover:text-blue-900">
                                <X size={12} />
                            </button>
                        </span>
                    )}
                    {endDate && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            To: {endDate}
                            <button onClick={() => { setEndDate(''); setPage(1); }} className="hover:text-blue-900">
                                <X size={12} />
                            </button>
                        </span>
                    )}
                    <button
                        onClick={handleResetFilters}
                        className="text-sm text-blue-600 hover:text-blue-800 font-semibold underline ml-1"
                    >
                        Clear All Filters
                    </button>
                </div>
            )}

            {/* Table */}
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[10px]">No.</TableHead>
                            <TableHead
                                className="w-[110px] cursor-pointer select-none group hover:text-blue-600 transition-colors"
                                onClick={() => handleSort('module')}
                            >
                                <div className="flex items-center">
                                    Module {renderSortIndicator('module')}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer select-none group hover:text-blue-600 transition-colors"
                                onClick={() => handleSort('title')}
                            >
                                <div className="flex items-center">
                                    Request Title {renderSortIndicator('title')}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer select-none group hover:text-blue-600 transition-colors"
                                onClick={() => handleSort('requester')}
                            >
                                <div className="flex items-center">
                                    Requester {renderSortIndicator('requester')}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer select-none group hover:text-blue-600 transition-colors"
                                onClick={() => handleSort('department')}
                            >
                                <div className="flex items-center">
                                    Department {renderSortIndicator('department')}
                                </div>
                            </TableHead>
                            {activeTab === 'watching' && (
                                <TableHead
                                    className="cursor-pointer select-none group hover:text-blue-600 transition-colors"
                                    onClick={() => handleSort('status')}
                                >
                                    <div className="flex items-center">
                                        Status {renderSortIndicator('status')}
                                    </div>
                                </TableHead>
                            )}
                            <TableHead
                                className="cursor-pointer select-none group hover:text-blue-600 transition-colors"
                                onClick={() => handleSort('created_at')}
                            >
                                <div className="flex items-center">
                                    Date Received {renderSortIndicator('created_at')}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer select-none group hover:text-blue-600 transition-colors"
                                onClick={() => handleSort('updated_at')}
                            >
                                <div className="flex items-center">
                                    Last Updated {renderSortIndicator('updated_at')}
                                </div>
                            </TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={activeTab === 'watching' ? 8 : 7} className="h-48 text-center text-slate-500 animate-pulse">
                                    Loading inbox...
                                </TableCell>
                            </TableRow>
                        ) : (
                            <>
                                {(inbox?.results || []).map((item: any, index: number) => (
                                    <TableRow key={item.id}>
                                        <TableCell>{((page - 1) * pageSize) + index + 1}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                                                    {getModuleIcon(item.module_code)}
                                                </div>
                                                <span className="font-medium text-sm text-slate-600">{item.module_name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-slate-900">{item.title}</p>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-sm text-slate-500">Ref: {item.reference_id}</p>
                                                    {item.purchase_type && (
                                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${item.purchase_type === 'asset'
                                                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                            : 'bg-slate-100 border-slate-200 text-slate-700'
                                                            }`}>
                                                            {item.purchase_type === 'asset' ? 'Asset' : 'Non Asset'}
                                                        </span>
                                                    )}
                                                    {item.asset_type && (
                                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${item.asset_type === 'wbs'
                                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                                            : 'bg-purple-50 border-purple-200 text-purple-700'
                                                            }`}>
                                                            {item.asset_type === 'wbs' ? 'WBS' : 'Non WBS'}
                                                        </span>
                                                    )}
                                                    {item.locked_by_name && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                                            <Lock size={11} className="text-amber-600" />
                                                            Being opened by {item.locked_by_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                                    {(item.requester_name || 'U')[0].toUpperCase()}
                                                </div>
                                                <span>{item.requester_name || '-'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-700 font-medium">
                                            {item.department || '-'}
                                        </TableCell>
                                        {activeTab === 'watching' && (
                                            <TableCell>
                                                {getStatusBadge(item.status)}
                                            </TableCell>
                                        )}
                                        <TableCell className="text-slate-500 text-sm">
                                            {formatDate(item.created_at)}
                                        </TableCell>
                                        <TableCell className="text-slate-500 text-sm">
                                            {formatDate(item.updated_at)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Link to={`/workflow/${item.id}`}>
                                                <Button variant="outline" size="sm" className="gap-2">
                                                    Review <ArrowUpRight size={14} />
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {(!inbox?.results || inbox.results.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={activeTab === 'watching' ? 8 : 7} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <Inbox className="h-12 w-12 opacity-10 mb-4" />
                                                <p className="text-lg font-medium">
                                                    {activeFiltersCount > 0 ? 'Data Not Found' : 'All caught up!'}
                                                </p>
                                                <p className="text-sm mt-1 max-w-sm">
                                                    {activeFiltersCount > 0
                                                        ? 'No approval task found matching your filters or search term.'
                                                        : (activeTab === 'inbox'
                                                            ? 'You have no pending approval tasks.'
                                                            : 'You are not watching any requests.')}
                                                </p>
                                                {activeFiltersCount > 0 && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleResetFilters}
                                                        className="mt-4 gap-1.5"
                                                    >
                                                        <RotateCw size={13} />
                                                        Reset Filter
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </>
                        )}
                    </TableBody>
                </Table>

                {inbox?.count !== undefined && inbox.count > 0 && (
                    <Pagination
                        currentPage={page}
                        pageSize={pageSize}
                        totalCount={inbox.count}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                    />
                )}
            </Card>
        </div>
    );
};
