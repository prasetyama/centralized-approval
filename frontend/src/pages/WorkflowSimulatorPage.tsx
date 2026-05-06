import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/atoms/Card';
import { Button } from '../components/atoms/Button';
import { Textarea } from '../components/atoms/Textarea';
import { CheckCircle, XCircle, Play } from 'lucide-react';
import api from '../services/api';

export const WorkflowSimulatorPage = () => {
    const defaultPayload = {
        "module_code": "EORDER",
        "workflow_id": 1,
        "title": "Order Submission PO Number C/FAD/U003/202604",
        "description": "Need approval for order PO Number C/FAD/U003/202604",
        "reference_id": "25060020260330A00703F12",
        "priority": "URGENT",
        "division": "JB",
        "payload": {
            "filename": "1050020260330A00703U05",
            "principle": "A00703",
            "po_number": "C/FAD/U003/202604",
            "total_quantity": 110,
            "total_sku": 1,
            "submitted_at": "2026-03-30T06:52:27.782Z",
            "items": [
                {
                    "sku": "F0000526",
                    "name": "DF FUNTIME LONG MILK VAN 12X20X26 G",
                    "qty": 100
                }
            ]
        }
    };

    const [payloadInput, setPayloadInput] = useState(JSON.stringify(defaultPayload, null, 4));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [simulationResult, setSimulationResult] = useState<any[] | null>(null);

    const handleSimulate = async () => {
        setError(null);
        setSimulationResult(null);
        setLoading(true);

        try {
            const parsedPayload = JSON.parse(payloadInput);
            const workflowId = parsedPayload.workflow_id;

            // Call API to fetch workflow definition ONLY, do not create ticket
            const response: any = await api.get(`/admin/workflows/${workflowId}/`);

            const data = response.success !== undefined ? response.data : response;

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

                    return { ...step, status };
                });

                setSimulationResult(simulatedSteps);
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
                            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                                {error}
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
                            <div className="relative border-l-2 border-slate-200 ml-4 space-y-8">
                                {simulationResult.map((step: any, index: number) => {
                                    const isApproved = step.status === 'APPROVED';
                                    const isRejected = step.status === 'REJECTED';
                                    const isWaiting = step.status === 'WAITING';

                                    return (
                                        <div key={index} className="relative pl-8 flex items-center min-h-[50px]">
                                            {/* Icon Indicator */}
                                            <div className="absolute -left-[17px] flex items-center justify-center w-8 h-8 rounded-full bg-white">
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
                                            <div className="flex-1 flex items-center justify-between">
                                                <div>
                                                    <p className="text-[15px] text-slate-700">
                                                        {isApproved ? 'Approved by ' : isRejected ? 'Rejected by ' : isWaiting ? 'Waiting Approval ' : 'Pending Approval '}
                                                        <span className="font-semibold text-slate-900">
                                                            {step.user_name || step.role_users[0].name} ({step.role_name})
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
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
