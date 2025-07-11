import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Tournament {
  id: string;
  name: string;
  description: string | null;
  game_type: string;
  entry_fee: number;
  prize_pool: number;
  max_teams: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  rules: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  organization: string | null;
}

export const useTournaments = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  console.log('🎯 useTournaments hook initialized, user:', user?.id);

  useEffect(() => {
    console.log('🔄 useTournaments useEffect triggered, user:', user?.id);
    const fetchTournaments = async () => {
      if (!user) {
        console.log('❌ No user found, clearing tournaments');
        setTournaments([]);
        setLoading(false);
        return;
      }

      console.log('🔄 Fetching tournaments for user:', user.id);

      // Get all tournaments first
      const { data: allTournaments, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching tournaments:', error);
        setLoading(false);
        return;
      }

      console.log('🏆 All tournaments fetched:', allTournaments?.length);

      // Get user's teams
      const { data: userTeams } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);

      const teamIds = userTeams?.map(t => t.team_id) || [];
      console.log('🔍 User teams:', teamIds);

      // Get organization bans for this user and their teams
      console.log('🔍 Querying bans for user:', user.id, 'and teams:', teamIds);
      console.log('🔍 Current auth user from supabase:', (await supabase.auth.getUser()).data.user?.id);
      
      // Test if we can read organization_bans table at all
      const { data: allBans, error: allBansError } = await supabase
        .from('organization_bans')
        .select('*')
        .limit(5);
      
      console.log('🔍 Can we read organization_bans table?', { allBans, allBansError });
      
      // Try direct user ban query first
      const { data: userBans, error: userBanError } = await supabase
        .from('organization_bans')
        .select('organization, banned_user_id, banned_team_id')
        .eq('banned_user_id', user.id);
      
      console.log('👤 User bans query result:', { userBans, userBanError, queriedUserId: user.id });
      
      // Try team bans query if user has teams
      let teamBans = [];
      if (teamIds.length > 0) {
        const { data: teamBansData, error: teamBanError } = await supabase
          .from('organization_bans')
          .select('organization, banned_user_id, banned_team_id')
          .in('banned_team_id', teamIds);
        
        console.log('👥 Team bans query result:', { teamBansData, teamBanError, queriedTeamIds: teamIds });
        teamBans = teamBansData || [];
      }
      
      // Combine both user and team bans
      const bans = [...(userBans || []), ...teamBans];
      console.log('🚫 Combined bans result:', { bans, userId: user.id, teamIds });

      // Get list of organizations that banned this user or their teams
      const bannedOrgs = new Set(bans?.map(ban => ban.organization) || []);
      console.log('🚫 Banned organizations:', Array.from(bannedOrgs));

      // Filter out tournaments from organizations that banned the user or their teams
      const filteredTournaments = allTournaments?.filter(tournament => {
        const shouldShow = !tournament.organization || !bannedOrgs.has(tournament.organization);
        console.log(`🏆 Tournament "${tournament.name}" from org "${tournament.organization}": ${shouldShow ? 'SHOW' : 'HIDE'}`);
        return shouldShow;
      }) || [];

      console.log('🏆 Total tournaments:', allTournaments?.length, 'Filtered tournaments:', filteredTournaments.length);

      setTournaments(filteredTournaments);
      setLoading(false);
    };

    fetchTournaments();

    // Subscribe to tournament changes
    const tournamentChannel = supabase
      .channel('tournament-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournaments',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTournaments(prev => [payload.new as Tournament, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setTournaments(prev => 
              prev.map(t => t.id === payload.new.id ? payload.new as Tournament : t)
            );
          } else if (payload.eventType === 'DELETE') {
            setTournaments(prev => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // Subscribe to organization ban changes to refresh tournaments
    const banChannel = supabase
      .channel('organization-ban-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'organization_bans',
        },
        () => {
          console.log('🚫 Organization ban changed, refreshing tournaments...');
          fetchTournaments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tournamentChannel);
      supabase.removeChannel(banChannel);
    };
  }, [user]);

  const createTournament = async (tournament: Omit<Tournament, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('tournaments')
      .insert([tournament])
      .select()
      .single();

    return { data, error };
  };

  const refetch = async () => {
    if (!user) {
      setTournaments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Get all tournaments first
    const { data: allTournaments, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tournaments:', error);
      setLoading(false);
      return;
    }

    // Get user's teams
    const { data: userTeams } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id);

    const teamIds = userTeams?.map(t => t.team_id) || [];
    console.log('🔍 Refetch - User teams:', teamIds);

    // Get organization bans for this user and their teams
    const { data: bans, error: banError } = await supabase
      .from('organization_bans')
      .select('organization, banned_user_id, banned_team_id')
      .or(`banned_user_id.eq.${user.id}${teamIds.length > 0 ? `,banned_team_id.in.(${teamIds.join(',')})` : ''}`);
    
    console.log('🚫 Refetch - Organization bans query result:', { bans, banError, userId: user.id, teamIds });

    // Get list of organizations that banned this user or their teams
    const bannedOrgs = new Set(bans?.map(ban => ban.organization) || []);
    console.log('🚫 Refetch - Banned organizations:', Array.from(bannedOrgs));

    // Filter out tournaments from organizations that banned the user or their teams
    const filteredTournaments = allTournaments?.filter(tournament => {
      const shouldShow = !tournament.organization || !bannedOrgs.has(tournament.organization);
      console.log(`🏆 Refetch - Tournament "${tournament.name}" from org "${tournament.organization}": ${shouldShow ? 'SHOW' : 'HIDE'}`);
      return shouldShow;
    }) || [];

    console.log('🏆 Refetch - Total tournaments:', allTournaments?.length, 'Filtered tournaments:', filteredTournaments.length);

    setTournaments(filteredTournaments);
    setLoading(false);
  };

  return {
    tournaments,
    loading,
    createTournament,
    refetch,
  };
};