import {createClient} from "@supabase/supabase-js";
import {auth} from "@clerk/nextjs/server";

export const createSupabaseClient = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable. Please check your .env.local file.");
    }
    
    if (!supabaseAnonKey) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. Please check your .env.local file.");
    }
    
    return createClient(
        supabaseUrl,
        supabaseAnonKey
    );
};

// For authenticated requests, use this function instead
export const createSupabaseClientWithAuth = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable. Please check your .env.local file.");
    }
    
    if (!supabaseAnonKey) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. Please check your .env.local file.");
    }
    
    try {
        const { getToken } = await auth();
        const token = await getToken();
        
        if (token) {
            return createClient(supabaseUrl, supabaseAnonKey, {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            });
        }
    } catch (error) {
        console.warn("Failed to get auth token, using anonymous client:", error);
    }
    
    // Fallback to anonymous client if auth fails
    return createClient(supabaseUrl, supabaseAnonKey);
};