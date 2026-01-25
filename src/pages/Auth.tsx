import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { handleError } from '@/utils/errorHandling';
import { validateEmail, validatePassword } from '@/utils/validation';
import { Branch } from '@/types/database';
import simbaLogo from '@/assets/simba-logo-hd.png';

const Auth = () => {
  console.log('Auth component rendering...');

  const navigate = useNavigate();
  const { signUp, signIn, signOut, user, profile } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);

  console.log('Auth state:', { user: !!user, profile: profile?.status, loading });

  // Sign up form state
  const [signUpData, setSignUpData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'staff' as 'staff' | 'admin',
    selectedBranch: '' // Single branch instead of array
  });

  // Sign in form state
  const [signInData, setSignInData] = useState({
    email: '',
    password: ''
  });

  useEffect(() => {
    console.log('Auth useEffect: checking user state', { user: !!user, profileStatus: profile?.status });
    // Redirect if already authenticated and approved
    if (user && profile?.status === 'approved') {
      console.log('Redirecting to home page');
      navigate('/');
    }
  }, [user, profile, navigate]);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    console.log('Fetching branches...');
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching branches:', error);
        return;
      }

      console.log('Branches fetched:', data?.length || 0);
      setBranches((data || []).map((b: any) => ({
        ...b,
        location: b.location ?? '',
        is_active: b.is_active ?? false,
        created_at: b.created_at ?? '',
        updated_at: b.updated_at ?? ''
      })));
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signUpData.password !== signUpData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    if (signUpData.role === 'staff' && !signUpData.selectedBranch) {
      alert('Please select a branch');
      return;
    }

    setLoading(true);
    await signUp(
      signUpData.email,
      signUpData.password,
      signUpData.firstName,
      signUpData.lastName,
      signUpData.role === 'admin' ? undefined : signUpData.selectedBranch, // Super admin has no branch
      signUpData.role
    );
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!validateEmail(signInData.email)) {
      handleError('Please enter a valid email address');
      return;
    }

    if (!signInData.password) {
      handleError('Please enter your password');
      return;
    }
    setLoading(true);
    const { data } = await signIn(signInData.email, signInData.password);
    if (data?.user) {
      // Check if user is approved
      const { data: profileData } = await supabase
        .from('profiles')
        .select('status, role')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (profileData?.status === 'pending') {
        alert('Your account is pending approval. Please contact an administrator.');
      } else if (profileData?.status === 'rejected') {
        alert('Your account has been rejected. Please contact an administrator.');
      } else if (profileData?.status === 'approved') {
        // Redirect based on role
        if (profileData.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/');
        }
      }
    }
    setLoading(false);
  };

  const handleBranchSelection = (branchCode: string) => {
    setSignUpData(prev => ({
      ...prev,
      selectedBranch: branchCode
    }));
  };

  if (user && profile?.status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={simbaLogo} alt="Simba Car Hire" className="h-16 mx-auto mb-4" />
            <CardTitle>Account Pending Approval</CardTitle>
            <CardDescription>
              Your account is awaiting approval from an administrator. You will be able to access the system once approved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={signOut}
              variant="outline"
              className="w-full"
            >
              Change Account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user && profile?.status === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={simbaLogo} alt="Simba Car Hire" className="h-16 mx-auto mb-4" />
            <CardTitle>Account Rejected</CardTitle>
            <CardDescription>
              Your account has been rejected. Please contact an administrator for more information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={signOut}
              variant="outline"
              className="w-full"
            >
              Change Account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  console.log('Rendering Auth main form');
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={simbaLogo} alt="Simba Car Hire" className="h-16 mx-auto mb-4" />
          <CardTitle>Simba Car Hire</CardTitle>
          <CardDescription>Refuel Management System</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={signInData.email}
                    onChange={(e) => setSignInData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={signInData.password}
                    onChange={(e) => setSignInData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={signUpData.firstName}
                      onChange={(e) => setSignUpData(prev => ({ ...prev, firstName: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={signUpData.lastName}
                      onChange={(e) => setSignUpData(prev => ({ ...prev, lastName: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signupEmail">Email</Label>
                  <Input
                    id="signupEmail"
                    type="email"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signupPassword">Password</Label>
                  <Input
                    id="signupPassword"
                    type="password"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={signUpData.confirmPassword}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Requested Role</Label>
                  <Select value={signUpData.role} onValueChange={(value: 'staff' | 'admin') => setSignUpData(prev => ({ ...prev, role: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Requested Branch Access</Label>
                  {signUpData.role === 'admin' ? (
                    <div className="text-sm text-muted-foreground">
                      Super Admin - Access to all branches
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {branches.length === 0 ? (
                        <div className="text-sm text-muted-foreground">Loading branches...</div>
                      ) : (
                        branches.map((branch) => (
                          <div key={branch.id} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id={branch.code}
                              name="branch"
                              value={branch.code}
                              checked={signUpData.selectedBranch === branch.code}
                              onChange={() => handleBranchSelection(branch.code)}
                              className="w-4 h-4 text-primary"
                            />
                            <Label htmlFor={branch.code} className="text-sm">
                              {branch.code} - {branch.name} ({branch.location})
                            </Label>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  {signUpData.role === 'staff' && branches.length > 0 && !signUpData.selectedBranch && (
                    <p className="text-xs text-red-500">Please select a branch</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating account...' : 'Sign Up'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;