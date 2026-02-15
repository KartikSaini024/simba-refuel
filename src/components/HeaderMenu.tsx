import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { PasswordChangeDialog } from '@/components/PasswordChangeDialog';
import ConnectRCM from '@/components/ConnectRCM';
import { Menu, Settings, LogOut } from 'lucide-react';
import BranchSelector from '@/components/BranchSelector';

interface HeaderMenuProps {
  profile: any;
  onSignOut: () => void;
  showBranchSelector?: boolean;
  selectedBranchId?: string | null;
  onBranchChange?: (branchId: string) => void;
}

export const HeaderMenu = ({
  profile,
  onSignOut,
  showBranchSelector = false,
  selectedBranchId,
  onBranchChange
}: HeaderMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const MenuItems = () => (
    <>
      <div className="md:hidden w-full">
        {showBranchSelector && onBranchChange && (
          <div className="mb-4">
            <BranchSelector
              selectedBranchId={selectedBranchId || null}
              onBranchChange={(id) => {
                onBranchChange(id);
                setIsOpen(false);
              }}
              className="w-full"
            />
          </div>
        )}
      </div>
      <ConnectRCM />
      <PasswordChangeDialog />
      {profile?.role === 'admin' && (
        <Link to="/admin" onClick={() => setIsOpen(false)}>
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            Admin Dashboard
          </Button>
        </Link>
      )}
      <Button variant="outline" size="sm" onClick={() => { onSignOut(); setIsOpen(false); }} className="w-full justify-start">
        <LogOut className="h-4 w-4 mr-2" />
        Sign Out
      </Button>
    </>
  );

  return (
    <>
      {/* Desktop Menu */}
      <div className="hidden md:flex items-center gap-2">
        <MenuItems />
      </div>

      {/* Mobile Menu */}
      <div className="md:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64">
            <div className="flex flex-col gap-4 mt-8">
              <MenuItems />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};