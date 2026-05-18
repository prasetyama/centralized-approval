import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Settings2, AlertCircle } from 'lucide-react';
import api from '@/services/api';
import { Button } from '@/components/atoms/Button';
import { Select } from '@/components/atoms/Select';
import { Input } from '@/components/atoms/Input';
import { formatThousandSeparator } from '@/lib/utils';

export interface Condition {
    field: string;
    operator: string;
    value: any;
}

interface CriteriaRuleBuilderProps {
    moduleId: number | string;
    conditions: Condition[];
    onChange: (conditions: Condition[]) => void;
}

export const CriteriaRuleBuilder: React.FC<CriteriaRuleBuilderProps> = ({
    moduleId,
    conditions,
    onChange
}) => {
    const { data: variables } = useQuery<any>({
        queryKey: ['module-variables', moduleId],
        queryFn: () => api.get(`/modules/${moduleId}/variables`),
        enabled: !!moduleId,
    });

    const operators = [
        { value: '==', label: 'Equals' },
        { value: '!=', label: 'Not Equals' },
        { value: '>', label: 'Greater Than' },
        { value: '<', label: 'Less Than' },
        { value: '>=', label: 'Greater or Equal' },
        { value: '<=', label: 'Less or Equal' },
    ];

    const handleAddCondition = () => {
        const firstVar = variables?.[0];
        const newCondition: Condition = {
            field: firstVar?.key_name || '',
            operator: '==',
            value: '',
        };
        onChange([...conditions, newCondition]);
    };

    // const handleRemoveCondition = (index: number) => {
    //     onChange(conditions.filter((_, i) => i !== index));
    // };

    const handleConditionChange = (index: number, updates: Partial<Condition>) => {
        const newConditions = [...conditions];
        newConditions[index] = { ...newConditions[index], ...updates };
        onChange(newConditions);
    };

    if (!moduleId) {
        return (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3 text-slate-500">
                <AlertCircle size={18} />
                <p className="text-xs font-medium">Please select a module first to define criteria.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Settings2 size={12} /> Execution Criteria
                </label>
                {conditions.length === 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAddCondition}
                        className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:bg-blue-50"
                    >
                        <Plus size={12} className="mr-1" /> Add Rule
                    </Button>
                )}
            </div>

            <div className="space-y-2">
                {conditions.map((condition, index) => {
                    const selectedVar = variables?.find((v: any) => v.key_name === condition.field);
                    const isNumber = selectedVar?.data_type === 'NUMBER';
                    const isBoolean = selectedVar?.data_type === 'BOOLEAN';

                    return (
                        <div key={index} className="flex gap-2 items-end animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex-1 grid grid-cols-12 gap-2">
                                <div className="col-span-5">
                                    <Select
                                        value={condition.field}
                                        onChange={(e) => handleConditionChange(index, { field: e.target.value })}
                                        options={(variables || []).map((v: any) => ({
                                            value: v.key_name,
                                            label: v.name
                                        }))}
                                        className="h-10 text-sm"
                                    />
                                </div>
                                <div className="col-span-3">
                                    <Select
                                        value={condition.operator}
                                        onChange={(e) => handleConditionChange(index, { operator: e.target.value })}
                                        options={isBoolean ? operators.slice(0, 2) : operators}
                                        className="h-10 text-sm"
                                    />
                                </div>
                                <div className="col-span-4">
                                    {isBoolean ? (
                                        <Select
                                            value={condition.value.toString()}
                                            onChange={(e) => handleConditionChange(index, { value: e.target.value === 'true' })}
                                            options={[
                                                { value: 'true', label: 'True' },
                                                { value: 'false', label: 'False' }
                                            ]}
                                            className="h-10 text-sm"
                                        />
                                    ) : (
                                        <Input
                                            type="text"
                                            value={
                                                isNumber && condition.value !== undefined && condition.value !== null && condition.value !== ''
                                                    ? formatThousandSeparator(
                                                        typeof condition.value === 'number'
                                                            ? condition.value
                                                            : parseFloat(condition.value.toString().replace(/\./g, ''))
                                                    )
                                                    : (condition.value ?? '')
                                            }
                                            onChange={(e) => {
                                                const rawValue = e.target.value;
                                                if (isNumber) {
                                                    const cleanValue = rawValue.replace(/\D/g, '');
                                                    const parsed = cleanValue === '' ? '' : parseFloat(cleanValue);
                                                    handleConditionChange(index, { value: parsed });
                                                } else {
                                                    handleConditionChange(index, { value: rawValue });
                                                }
                                            }}
                                            error={condition.value === '' || isNaN(condition.value) ? "Field is required" : ""}
                                            placeholder="Value..."
                                            className="h-10 text-sm"
                                        />
                                    )}
                                </div>
                            </div>
                            {/* <button
                                type="button"
                                onClick={() => handleRemoveCondition(index)}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Trash2 size={16} />
                            </button> */}
                        </div>
                    );
                })}

                {conditions.length === 0 && (
                    <div className="p-3 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        <p className="text-[10px] font-bold text-slate-400">This step will always execute.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
