import api from './api';

export interface PRNonTradeItem {
    id?: number;
    item_order?: number;
    goods_code: string;
    goods_name: string;
    unit: string;
    quantity: number;
    remark: string;
}

export interface PRNonTradeData {
    id?: number;
    transaction_id?: string;
    transaction_date?: string;
    requestor_name?: string;
    requester_department?: string;
    requester_company?: string;
    purpose: string;
    goods_service_type: 'lumpsum' | 'not_lumpsum';
    purchase_type: 'asset' | 'non_asset';
    car_tbr_no?: string;
    asset_type: 'non_wbs' | 'wbs';
    asset_no?: string;
    wbs_no?: string;
    equipment_name?: string;
    submission_remark?: string;
    status?: 'DRAFT' | 'SUBMITTED' | 'CANCELLED';
    approval_request?: number;
    created_at?: string;
    updated_at?: string;
    items: PRNonTradeItem[];
}

export interface MasterItem {
    id: number;
    code: string;
    name?: string;
    description?: string;
    unit?: string;
    category?: string;
    project_name?: string;
}

export const prNonTradeService = {
    getList: async (): Promise<{ results?: PRNonTradeData[] } | PRNonTradeData[]> => {
        return api.get('/pr-non-trade/');
    },

    getDetail: async (id: number | string): Promise<PRNonTradeData> => {
        return api.get(`/pr-non-trade/${id}/`);
    },

    saveDraft: async (data: PRNonTradeData): Promise<{ success: boolean; message: string; data: PRNonTradeData }> => {
        return api.post('/pr-non-trade/save-draft/', data);
    },

    submitPR: async (data: PRNonTradeData): Promise<{ success: boolean; message: string; data: PRNonTradeData; approval_request_id?: number }> => {
        return api.post('/pr-non-trade/submit/', data);
    },

    deleteDraft: async (id: number | string): Promise<void> => {
        return api.delete(`/pr-non-trade/${id}/`);
    },

    // Master Data Search APIs
    searchAssets: async (q: string = ''): Promise<{ results?: MasterItem[] } | MasterItem[]> => {
        return api.get(`/master/assets/`, { params: { search: q } });
    },

    searchWBS: async (q: string = ''): Promise<{ results?: MasterItem[] } | MasterItem[]> => {
        return api.get(`/master/wbs/`, { params: { search: q } });
    },

    searchEquipments: async (q: string = ''): Promise<{ results?: MasterItem[] } | MasterItem[]> => {
        return api.get(`/master/equipments/`, { params: { search: q } });
    },

    searchGoods: async (q: string = ''): Promise<{ results?: MasterItem[] } | MasterItem[]> => {
        return api.get(`/master/goods/`, { params: { search: q } });
    },
};
