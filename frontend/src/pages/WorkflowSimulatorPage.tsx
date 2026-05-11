import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Textarea } from '../components/atoms/Textarea';
import { CheckCircle, XCircle, Play, X, Eye } from 'lucide-react';
import api from '../services/api';
import { Select } from '@/components/atoms/Select';
import { Badge } from '@/components/atoms/Badge';
import { useQuery } from '@tanstack/react-query';
import { PayloadRenderer } from '@/components/molecules/PayloadRenderer';

export const WorkflowSimulatorPage = () => {
    const defaultPayload = {
        "module_code": "EORDER",
        "workflow_id": 1,
        "title": "Order Submission PO Number C/FAD/U003/202604",
        "description": "Need approval for order PO Number C/FAD/U003/202604",
        "priority": "URGENT",
        "payload": {
            "reference_id": "1050020260330A00703U05",
            "principle": "A00703",
            "po_number": "C/FAD/U003/202604",
            "distributor": "PT. BINTANG SINAR JAYA",
            "total_quantity": 110,
            "total_sku": 1,
            "submitted_at": "2026-03-30T06:52:27.782Z",
            "order_type": "3",
            "brand_code": "SQ",
            "items": [
                {
                    "sku": "F0000526",
                    "name": "DF FUNTIME LONG MILK VAN 12X20X26 G",
                    "qty": 100,
                    "price": 30000
                }
            ],
            "total_amount": 3000000
        }
    };

    const [payloadInput, setPayloadInput] = useState(JSON.stringify(defaultPayload, null, 4));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [simulationResult, setSimulationResult] = useState<any[] | null>(null);
    const [simulatedData, setSimulatedData] = useState<any | null>(null);
    const [selectedWatcherIds, setSelectedWatcherIds] = useState<number[]>([]);

    const { data: usersData } = useQuery({
        queryKey: ['users-all'],
        queryFn: () => api.get('/admin/users', { params: { is_active: true } }) as Promise<any>,
    });

    const users = usersData?.results || [];

    const handleSimulate = async () => {
        setError(null);
        setSimulationResult(null);
        setLoading(true);

        try {
            const parsedPayload = JSON.parse(payloadInput);
            const workflowId = parsedPayload.workflow_id;

            // Call API to fetch workflow definition and brands
            const [workflowResponse, brandsResponse]: any[] = await Promise.all([
                api.get(`/admin/workflows/${workflowId}/`),
                api.get('/admin/brands/')
            ]);

            const data = workflowResponse.success !== undefined ? workflowResponse.data : workflowResponse;
            const brands = brandsResponse.results || brandsResponse;

            if (data && data.steps) {
                let hasWaiting = false;

                const simulatedSteps = data.steps.map((step: any) => {
                    let isSkipped = false;
                    if (step.condition_expression) {
                        try {
                            const evaluate = new Function('payload', `return ${step.condition_expression}`);
                            isSkipped = !evaluate(parsedPayload.payload);
                        } catch (e) {
                            console.warn("Condition eval failed:", e);
                            isSkipped = true;
                        }
                    }

                    let status = 'PENDING';
                    if (isSkipped) {
                        status = 'SKIPPED';
                    } else if (!hasWaiting) {
                        status = 'WAITING';
                        hasWaiting = true;
                    }

                    let simulatedAssignee = null;
                    if (step.is_brand_conditional && !isSkipped) {
                        const masterWorkflowCriteriaKey = step.master_workflow_criteria_key_param_json;
                        if (masterWorkflowCriteriaKey) {
                            const criteriaValue = parsedPayload.payload?.[masterWorkflowCriteriaKey];
                            if (criteriaValue) {
                                const brand = brands.find((b: any) => b.code === criteriaValue);
                                if (brand) {
                                    simulatedAssignee = brand?.owner_name;
                                } else {
                                    throw new Error(`Condition '${criteriaValue}' not found.`);
                                }
                            } else {
                                throw new Error(`Master workflow criteria value not found for key ${masterWorkflowCriteriaKey}.`);
                            }
                        } else {
                            throw new Error("Master workflow criteria key not found.");
                        }
                    }

                    return { ...step, status, simulatedAssignee };
                });

                setSimulationResult(simulatedSteps);
                setSimulatedData(parsedPayload);
            } else {
                setError("Invalid workflow definition format from server.");
            }
        } catch (err: any) {
            if (err instanceof SyntaxError) {
                setError("Invalid JSON format. Please check your payload.");
            } else {
                setError(err.message || err.toString() || "An error occurred during simulation.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        try {
            const parsedPayload = JSON.parse(payloadInput);
            const response = await api.post('/workflow/submit', {
                ...parsedPayload,
                watcher_ids: selectedWatcherIds
            });
            alert('Request submitted successfully with watchers!');
            console.log('Submit response:', response);
        } catch (err: any) {
            setError(err.message || "Submit failed");
        } finally {
            setLoading(false);
        }
    };

    const handleAction = (stepIndex: number, action: 'APPROVE' | 'REJECT') => {
        if (!simulationResult) return;

        const newResult = [...simulationResult];

        if (action === 'REJECT') {
            newResult[stepIndex].status = 'REJECTED';
            // Set all subsequent non-skipped steps to REJECTED
            for (let i = stepIndex + 1; i < newResult.length; i++) {
                if (newResult[i].status !== 'SKIPPED') {
                    newResult[i].status = 'REJECTED';
                }
            }
        } else if (action === 'APPROVE') {
            newResult[stepIndex].status = 'APPROVED';

            // Set the next non-skipped step to WAITING
            for (let i = stepIndex + 1; i < newResult.length; i++) {
                if (newResult[i].status !== 'SKIPPED') {
                    newResult[i].status = 'WAITING';
                    break;
                }
            }
        }

        setSimulationResult(newResult);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Workflow Simulator
                </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Input */}
                <Card className="flex flex-col h-[calc(100vh-180px)] overflow-y-auto">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg flex items-center">
                            JSON Payload Input
                        </CardTitle>
                        <p className="text-sm text-slate-500">
                            Masukkan data yang akan dikirim ke <code>/api/v1/workflow/submit</code>.
                        </p>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col space-y-4 overflow-hidden">
                        <Textarea
                            className="font-mono text-sm h-full resize-none flex-1 min-h-[60vh]"
                            value={payloadInput}
                            onChange={(e) => setPayloadInput(e.target.value)}
                            spellCheck={false}
                        />
                        {error && (
                            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md flex items-center justify-between">
                                <div className='flex items-center gap-2'>
                                    {error}
                                </div>
                                <X className="w-4 h-4 cursor-pointer hover:opacity-50 transition-opacity" onClick={() => setError('')} />
                            </div>
                        )}
                        <Button
                            onClick={handleSimulate}
                            loading={loading}
                            className="w-full flex items-center justify-center gap-2"
                        >
                            <Play className="w-4 h-4" />
                            Run Simulation
                        </Button>

                        <div className="pt-6 border-t border-slate-100 space-y-4">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Eye size={16} /> Add Watchers (Pre-submission)
                            </h3>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {selectedWatcherIds.map(id => {
                                    const user = users.find((u: any) => u.id === id);
                                    return (
                                        <Badge key={id} variant="info" className="gap-1 pr-1">
                                            {user?.username || id}
                                            <X
                                                size={14}
                                                className="cursor-pointer hover:text-red-500"
                                                onClick={() => setSelectedWatcherIds(prev => prev.filter(i => i !== id))}
                                            />
                                        </Badge>
                                    );
                                })}
                            </div>
                            <Select
                                value=""
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (val && !selectedWatcherIds.includes(val)) {
                                        setSelectedWatcherIds(prev => [...prev, val]);
                                    }
                                }}
                                options={[
                                    { value: '', label: 'Add a watcher...' },
                                    ...users.map((u: any) => ({
                                        value: u.id.toString(),
                                        label: `${u.first_name} ${u.last_name} (${u.username})`
                                    }))
                                ]}
                            />
                            <Button
                                onClick={handleSubmit}
                                loading={loading}
                                variant="outline"
                                className="w-full border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold"
                            >
                                Submit Request with Watchers
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Right Column: Output */}
                <Card className="flex flex-col h-[calc(100vh-180px)]">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Hasil Simulasi</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-y-auto justify-center">
                        {!simulationResult ? (
                            <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                                No Result
                            </div>
                        ) : (
                            <div className="flex flex-col gap-8">
                                {/* Preview Data Section */}
                                <PayloadRenderer
                                    moduleCode={simulatedData.module_code}
                                    payload={simulatedData.payload}
                                />

                                {/* Timeline */}
                                <div className="relative ml-4 space-y-8 z-1">
                                    {simulationResult.map((step: any, index: number) => {
                                        const isApproved = step.status === 'APPROVED';
                                        const isRejected = step.status === 'REJECTED';
                                        const isWaiting = step.status === 'WAITING';

                                        return (
                                            <div key={index} className="relative pl-8 flex flex-col min-h-[50px]">
                                                {/* Timeline vertical lines */}
                                                {index !== 0 && (
                                                    <div className="absolute left-[-1px] top-0 h-1/2 w-[2px] bg-slate-200 z-10" />
                                                )}
                                                {index !== simulationResult.length - 1 && (
                                                    <div className="absolute left-[-1px] top-1/2 bottom-[-32px] w-[2px] bg-slate-200 z-10" />
                                                )}

                                                {/* Icon Indicator */}
                                                <div className="absolute -left-[17px] flex items-center justify-center w-8 h-8 rounded-full bg-white z-10">
                                                    {isApproved ? (
                                                        <CheckCircle className="w-8 h-8 text-emerald-500 bg-white" />
                                                    ) : isRejected ? (
                                                        <XCircle className="w-8 h-8 text-red-500 bg-white" />
                                                    ) : (
                                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-400 border-[3px] border-white text-white">
                                                            <span className="text-[10px] font-bold">{index + 1}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 flex flex-col">
                                                    <div>
                                                        <p className="text-[15px] text-slate-700">
                                                            {isApproved ? 'Approved by ' : isRejected ? 'Rejected by ' : isWaiting ? 'Waiting Approval ' : 'Pending Approval '}
                                                            <span className="font-semibold text-slate-900">
                                                                {step.simulatedAssignee || step.user_name || (step.role_users && step.role_users[0]?.name) || "Unassigned"}  ({step.name})
                                                            </span>
                                                        </p>
                                                        {(step.condition_expression || step.condition) && (
                                                            <p className="text-xs text-slate-400 mt-0.5">
                                                                Condition: {step.condition_expression || step.condition}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {isWaiting && (
                                                        <div className="flex gap-2 ml-4">
                                                            <Button
                                                                size="sm"
                                                                variant="danger"
                                                                className="rounded-full px-4 shadow-md"
                                                                onClick={() => handleAction(index, 'REJECT')}
                                                            >
                                                                Reject
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="primary"
                                                                className="rounded-full px-6 shadow-md"
                                                                onClick={() => handleAction(index, 'APPROVE')}
                                                            >
                                                                Approve
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Final Result Card */}
                                    {(() => {
                                        const isRejected = simulationResult.some(s => s.status === 'REJECTED');
                                        const isAllApproved = simulationResult.every(s => s.status === 'APPROVED' || s.status === 'SKIPPED');

                                        if (isRejected) {
                                            return (
                                                <div className="mt-8 p-2 bg-red-50 border-2 border-red-200 rounded-2xl animate-in zoom-in duration-300">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-200">
                                                            <XCircle size={28} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-xl font-black text-red-900 leading-none">Workflow Rejected</h3>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        if (isAllApproved) {
                                            return (
                                                <div className="mt-8 p-2 bg-emerald-50 border-2 border-emerald-200 rounded-2xl animate-in zoom-in duration-300">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                                                            <CheckCircle size={24} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-xl font-black text-emerald-900 leading-none">Workflow Approved</h3>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return null;
                                    })()}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
