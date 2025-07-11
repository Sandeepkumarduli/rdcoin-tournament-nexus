import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Edit, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import CreateTournamentDialog from '@/components/CreateTournamentDialog';
import UpdateRoomDialog from '@/components/admin/UpdateRoomDialog';
import EditTournamentDialog from '@/components/admin/EditTournamentDialog';
import { useAdminTournaments } from '@/hooks/useAdminTournaments';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';

interface AdminTournamentsTabProps {
  onRefresh: () => void;
}

const AdminTournamentsTab = ({ onRefresh }: AdminTournamentsTabProps) => {
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const { tournaments, loading, refetch } = useAdminTournaments();
  const { toast } = useToast();

  const handleDeleteTournament = async (tournamentId: string) => {
    console.log('🗑️ Starting tournament deletion for ID:', tournamentId);
    
    try {
      // First, delete related org_user_registrations
      console.log('🗑️ Step 1: Deleting org_user_registrations...');
      const { error: registrationError } = await supabase
        .from('org_user_registrations')
        .delete()
        .eq('tournament_id', tournamentId);

      if (registrationError) {
        console.error('❌ Error deleting org_user_registrations:', registrationError);
        throw registrationError;
      }
      console.log('✅ org_user_registrations deleted successfully');

      // Then, delete related tournament_registrations
      console.log('🗑️ Step 2: Deleting tournament_registrations...');
      const { error: tournamentRegError } = await supabase
        .from('tournament_registrations')
        .delete()
        .eq('tournament_id', tournamentId);

      if (tournamentRegError) {
        console.error('❌ Error deleting tournament_registrations:', tournamentRegError);
        throw tournamentRegError;
      }
      console.log('✅ tournament_registrations deleted successfully');

      // Finally, delete the tournament
      console.log('🗑️ Step 3: Deleting tournament...');
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournamentId);

      if (error) {
        console.error('❌ Error deleting tournament:', error);
        throw error;
      }
      console.log('✅ Tournament deleted successfully');

      toast({
        title: "Tournament Deleted",
        description: "Tournament and all related registrations have been successfully deleted",
      });
      
      refetch();
    } catch (error) {
      console.error('❌ Overall error deleting tournament:', error);
      toast({
        title: "Error",
        description: `Failed to delete tournament: ${error.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };


  const filteredTournaments = tournaments.filter(tournament => {
    if (statusFilter !== 'All' && tournament.status !== statusFilter) return false;
    if (dateFilter && tournament.startDate) {
      const tournamentDate = tournament.startDate.split(' ')[0]; // Extract date part
      if (tournamentDate !== dateFilter) return false;
    }
    return true;
  });

  const handleRefresh = async () => {
    await refetch();
    onRefresh();
    toast({
      title: "Data Fetched Successfully",
      description: "Tournaments data has been refreshed",
    });
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const clearFilters = () => {
    setStatusFilter('All');
    setDateFilter('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">ORG Tournaments</h2>
        <div className="flex gap-2">
          <CreateTournamentDialog />
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="Live">Live</SelectItem>
            <SelectItem value="Upcoming">Upcoming</SelectItem>
          </SelectContent>
        </Select>
        
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-40"
          placeholder="Date Filter"
        />
        
        <Button variant="outline" onClick={clearFilters} size="sm">
          <X className="h-4 w-4 mr-2" />
          Clear All
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTournaments.map((tournament) => (
          <Card key={tournament.id} className="gaming-card h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">{tournament.name}</CardTitle>
                <Badge variant={tournament.status === "Live" ? "destructive" : tournament.status === "Completed" ? "secondary" : "default"}>
                  {tournament.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prize Pool:</span>
                  <span className="font-semibold text-gaming-gold">{tournament.prize.toLocaleString()} rdCoins</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Entry Fee:</span>
                  <span className="font-medium">{tournament.entryFee.toLocaleString()} rdCoins</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Start Date:</span>
                  <span className="font-medium">{tournament.startDate}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Start Time:</span>
                  <span className="font-medium">{tournament.startTime}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Game Mode:</span>
                  <span className="font-medium">{tournament.gameType}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Max Teams:</span>
                  <span className="font-medium">{tournament.maxTeams || 'Unlimited'}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Registered:</span>
                  <span className="font-medium">{tournament.participants}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Room Status:</span>
                  <span className={`font-medium ${tournament.roomId ? 'text-success' : 'text-warning'}`}>
                    {tournament.roomId ? 'Ready' : 'Needs Update'}
                  </span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ORG:</span>
                  <span className="font-medium text-primary">{tournament.org}</span>
                </div>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <UpdateRoomDialog 
                  tournamentId={tournament.id}
                  currentRoomId={tournament.roomId}
                  currentRoomPassword={tournament.roomPassword}
                  onUpdate={refetch}
                />
                <EditTournamentDialog 
                  tournament={tournament}
                  onUpdate={refetch}
                />
                <Button variant="destructive" size="sm" onClick={() => handleDeleteTournament(tournament.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminTournamentsTab;