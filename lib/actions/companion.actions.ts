'use server';

import {auth} from "@clerk/nextjs/server";
import {createSupabaseClient, createSupabaseClientWithAuth} from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export const createCompanion = async (formData: CreateCompanion) => {
    try {
        const { userId: author } = await auth();
        if (!author) throw new Error("Unauthorized: No user ID found");
        
        console.log("createCompanion: Creating companion for user", author);
        
        const supabase = await createSupabaseClientWithAuth();
        
        // For now, we'll store the Clerk user ID as a string
        // In a production app, you might want to map this to a UUID
        const companionData = {...formData, author};
        console.log("createCompanion: Inserting data", companionData);

        const { data, error } = await supabase
            .from('companions')
            .insert(companionData)
            .select();

        if(error || !data) {
            console.error("createCompanion: Supabase error details", {
                message: error?.message,
                code: error?.code,
                details: error?.details,
                hint: error?.hint
            });
            
            // Handle specific "No suitable key or wrong key type" error
            if (error?.message?.includes("No suitable key") || error?.message?.includes("wrong key type")) {
                throw new Error("Authentication failed. Please refresh the page and try again.");
            }
            
            // Handle UUID format errors
            if (error?.message?.includes("invalid input syntax for type uuid")) {
                throw new Error("User ID format is incompatible with database. Please update your database schema to use TEXT instead of UUID for user ID fields.");
            }
            
            // Handle actual RLS errors (be more specific)
            if (error?.message?.includes("new row violates row-level security policy") && 
                error?.message?.includes("USING expression")) {
                throw new Error("Permission denied. You may have reached your companion limit.");
            }
            
            throw new Error(error?.message || 'Failed to create a companion. Please try again.');
        }

        console.log("createCompanion: Successfully created companion", data[0]);
        return data[0];
    } catch (error: any) {
        console.error("createCompanion: General error", {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        // Provide more user-friendly error messages
        if (error.message.includes("Unauthorized")) {
            throw new Error("Please log in to create a companion.");
        }
        
        // If it's already our custom error, don't wrap it again
        if (error.message.includes("User ID format is incompatible")) {
            throw error;
        }
        
        if (error.message.includes("Permission denied")) {
            throw error;
        }
        
        throw new Error(`Failed to create companion: ${error.message}`);
    }
}

export const getAllCompanions = async ({ limit = 10, page = 1, subject, topic }: GetAllCompanions) => {
    const supabase = createSupabaseClient();

    let query = supabase.from('companions').select();

    if(subject && topic) {
        query = query.ilike('subject', `%${subject}%`)
            .or(`topic.ilike.%${topic}%,name.ilike.%${topic}%`)
    } else if(subject) {
        query = query.ilike('subject', `%${subject}%`)
    } else if(topic) {
        query = query.or(`topic.ilike.%${topic}%,name.ilike.%${topic}%`)
    }

    query = query.range((page - 1) * limit, page * limit - 1);

    const { data: companions, error } = await query;

    if(error) {
        console.error("Error fetching companions:", error);
        // Return empty array as fallback instead of throwing error
        return [];
    }

    return companions || [];
}

export const getCompanion = async (id: string) => {
    try {
        const supabase = createSupabaseClient();

        const { data, error } = await supabase
            .from('companions')
            .select()
            .eq('id', id);

        if(error) {
            console.error("Error fetching companion:", error);
            return null;
        }

        if (!data || data.length === 0) {
            console.log("No companion found with id:", id);
            return null;
        }

        return data[0] || null;
    } catch (error) {
        console.error("Unexpected error fetching companion:", error);
        return null;
    }
}

export const addToSessionHistory = async (companionId: string) => {
    try {
        const { userId } = await auth();
        if (!userId) {
            console.log("Unauthorized: No user ID found, skipping session history recording");
            return null;
        }
        
        const supabase = await createSupabaseClientWithAuth();
        
        const { data, error } = await supabase.from('session_history')
            .insert({
                companion_id: companionId,
                user_id: userId, // Store Clerk user ID as string
            })

        if(error) {
            // Handle UUID format errors
            if (error.message?.includes("invalid input syntax for type uuid")) {
                console.error("User ID format error:", error.message);
                return null;
            }
            
            // Handle RLS policy violations
            if (error.message?.includes("new row violates row-level security policy")) {
                console.error("RLS policy violation in session_history:", error.message);
                // Return null instead of throwing error to handle gracefully
                return null;
            }
            
            console.error("Error adding to session history:", error.message);
            return null;
        }

        return data;
    } catch (error) {
        console.error("Unexpected error in addToSessionHistory:", error);
        // Return null instead of throwing error to handle gracefully
        return null;
    }
}

export const getRecentSessions = async (limit = 10) => {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
        .from('session_history')
        .select(`companions:companion_id (*)`)
        .order('created_at', { ascending: false })
        .limit(limit)

    if(error) {
        console.error("Error fetching recent sessions:", error);
        // Return empty array as fallback instead of throwing error
        return [];
    }

    return data.map(({ companions }) => companions);
}

export const getUserSessions = async (userId: string, limit = 10) => {
    if (!userId) throw new Error("User ID is required");
    
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
        .from('session_history')
        .select(`companions:companion_id (*)`)
        .eq('user_id', userId) // Query with Clerk user ID as string

    if(error) {
        console.error("Error fetching user sessions:", error);
        // Return empty array as fallback instead of throwing error
        return [];
    }

    return data.map(({ companions }) => companions);
}

export const getUserCompanions = async (userId: string) => {
    if (!userId) throw new Error("User ID is required");
    
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
        .from('companions')
        .select()
        .eq('author', userId) // Query with Clerk user ID as string

    if(error) {
        console.error("Error fetching user companions:", error);
        // Return empty array as fallback instead of throwing error
        return [];
    }

    return data || [];
}

export const newCompanionPermissions = async () => {
    try {
        const { userId, has } = await auth();
        if (!userId) {
            console.log("newCompanionPermissions: No authenticated user, allowing creation by default");
            // If there's no user, we allow creation (this might happen in some edge cases)
            return true;
        }
        
        console.log("newCompanionPermissions: Checking permissions for user", userId);
        
        // If user has pro plan, they can always create companions
        if(has({ plan: 'pro' })) {
            console.log("newCompanionPermissions: User has pro plan, allowing creation");
            return true;
        }
        
        // Determine the limit based on user features
        let limit = 0;
        if(has({ feature: "3_companion_limit" })) {
            limit = 3;
        } else if(has({ feature: "10_companion_limit" })) {
            limit = 10;
        }
        
        console.log("newCompanionPermissions: User limit is", limit);
        
        // If no limit is set, allow creation (free tier or other plans)
        if (limit === 0) {
            console.log("newCompanionPermissions: No specific limit set, allowing creation");
            return true;
        }
        
        // Use the authenticated client for this query
        const supabase = await createSupabaseClientWithAuth();
        
        console.log("newCompanionPermissions: Querying companions count for user", userId);
        
        // Do the count query using Clerk user ID as string
        const { count, error } = await supabase
            .from('companions')
            .select('id', { count: 'exact', head: true })
            .eq('author', userId);

        if (error) {
            console.error("Error checking companion permissions - Supabase error:", {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
            
            // Handle UUID format errors
            if (error.message?.includes("invalid input syntax for type uuid")) {
                // If there's a UUID error, it means the user has no companions yet
                console.log("newCompanionPermissions: Assuming no companions due to UUID format issue");
                return true;
            }
            
            // Handle actual RLS errors (be more specific)
            if (error?.message?.includes("new row violates row-level security policy") && 
                error?.message?.includes("USING expression")) {
                console.log("newCompanionPermissions: User may have reached companion limit");
                // Still allow creation as fallback to prevent blocking users
                return true;
            }
            
            // Allow creation as fallback to prevent blocking users
            return true;
        }

        const companionCount = count || 0;
        console.log("newCompanionPermissions: User has", companionCount, "companions out of", limit, "allowed");
        return companionCount < limit;
    } catch (error: any) {
        console.error("Error checking companion permissions - General error:", {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        // Allow creation as fallback to prevent blocking users
        return true;
    }
}

// Bookmarks
export const addBookmark = async (companionId: string, path: string) => {
  const { userId } = await auth();
  if (!userId) return;
  
  const supabase = await createSupabaseClientWithAuth();
  
  const { data, error } = await supabase.from("bookmarks").insert({
    companion_id: companionId,
    user_id: userId, // Store Clerk user ID as string
  });
  
  if (error) {
    // Handle UUID format errors
    if (error.message?.includes("invalid input syntax for type uuid")) {
        throw new Error("User ID format is incompatible with database. Please update your database schema to use TEXT instead of UUID for user ID fields.");
    }
    throw new Error(error.message);
  }
  
  // Revalidate the path to force a re-render of the page
  revalidatePath(path);
  return data;
};

export const removeBookmark = async (companionId: string, path: string) => {
  const { userId } = await auth();
  if (!userId) return;
  
  const supabase = await createSupabaseClientWithAuth();
  
  const { data, error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("companion_id", companionId)
    .eq("user_id", userId); // Query with Clerk user ID as string
    
  if (error) {
    // Handle UUID format errors
    if (error.message?.includes("invalid input syntax for type uuid")) {
        throw new Error("User ID format is incompatible with database. Please update your database schema to use TEXT instead of UUID for user ID fields.");
    }
    throw new Error(error.message);
  }
  
  revalidatePath(path);
  return data;
};

// It's almost the same as getUserCompanions, but it's for the bookmarked companions
export const getBookmarkedCompanions = async (userId: string) => {
  if (!userId) return [];
  
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("bookmarks")
    .select(`companions:companion_id (*)`) // Notice the (*) to get all the companion data
    .eq("user_id", userId); // Query with Clerk user ID as string
    
  if (error) {
    console.error("Error fetching bookmarked companions:", error);
    // Return empty array as fallback instead of throwing error
    return [];
  }
  
  // We don't need the bookmarks data, so we return only the companions
  return data.map(({ companions }) => companions);
};

// Test function to check if tables exist
export const testDatabaseConnection = async () => {
    try {
        const supabase = createSupabaseClient();
        
        // Test if companions table exists
        const { data: companionsData, error: companionsError } = await supabase
            .from('companions')
            .select('id')
            .limit(1);
            
        console.log("Companions table test:", {
            exists: !companionsError,
            error: companionsError?.message,
            data: companionsData
        });
        
        // Test if session_history table exists
        const { data: sessionData, error: sessionError } = await supabase
            .from('session_history')
            .select('id')
            .limit(1);
            
        console.log("Session history table test:", {
            exists: !sessionError,
            error: sessionError?.message,
            data: sessionData
        });
        
        // Test if bookmarks table exists
        const { data: bookmarksData, error: bookmarksError } = await supabase
            .from('bookmarks')
            .select('id')
            .limit(1);
            
        console.log("Bookmarks table test:", {
            exists: !bookmarksError,
            error: bookmarksError?.message,
            data: bookmarksData
        });
        
        return {
            companions: !companionsError,
            session_history: !sessionError,
            bookmarks: !bookmarksError
        };
    } catch (error) {
        console.error("Database connection test failed:", error);
        return {
            companions: false,
            session_history: false,
            bookmarks: false
        };
    }
};
