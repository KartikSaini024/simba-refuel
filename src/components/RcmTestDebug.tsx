import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Terminal, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const RcmTestDebug: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const runTest = async () => {
        setIsLoading(true);
        setResult(null);

        try {
            const response = await fetch('/api/test-rcm-login', {
                method: 'POST',
            });

            const data = await response.json();
            setResult(data);

            if (data.success) {
                if (data.cookies) {
                    localStorage.setItem('rcm_cookies', data.cookies);
                }

                toast({
                    title: "Connection Successful",
                    description: "Successfully authenticated. Cookies saved.",
                });
            } else {
                toast({
                    variant: "destructive",
                    title: "Connection Failed",
                    description: data.message || "Failed to authenticate.",
                });
            }

        } catch (error) {
            console.error('Test failed:', error);
            setResult({ success: false, error: 'Network or Server Error' });
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not contact the backend proxy.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Terminal className="h-4 w-4" />
                    Connect RCM
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>RCM Connection</DialogTitle>
                    <DialogDescription>
                        Tries to login to RCM using hardcoded dev credentials to verify connectivity and cookie retrieval.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-4">
                    <Button onClick={runTest} disabled={isLoading} className="w-full">
                        {isLoading ? "Connecting..." : "Run Connection Test"}
                    </Button>

                    {result && (
                        <div className={`p-4 rounded-md text-sm border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-center gap-2 font-medium mb-2">
                                {result.success ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                    <XCircle className="h-4 w-4 text-red-600" />
                                )}
                                <span className={result.success ? 'text-green-700' : 'text-red-700'}>
                                    {result.success ? 'Authentication Success' : 'Authentication Failed'}
                                </span>
                            </div>

                            {result.redirect && (
                                <div className="mb-2 text-xs text-gray-600">
                                    <strong>Redirect:</strong> {result.redirect}
                                </div>
                            )}

                            {result.cookies && (
                                <div className="mt-2">
                                    <div className="text-xs font-semibold text-gray-700 mb-1">Cookies Acquired:</div>
                                    <pre className="text-[10px] bg-white p-2 rounded border overflow-x-auto whitespace-pre-wrap break-all h-24">
                                        {result.cookies}
                                    </pre>
                                </div>
                            )}

                            {result.details && (
                                <div className="mt-2 text-xs text-red-600">
                                    {result.details}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default RcmTestDebug;
