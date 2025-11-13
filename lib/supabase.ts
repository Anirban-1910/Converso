import {createClient, type SupabaseClient} from "@supabase/supabase-js";
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
        const { getToken, userId } = await auth();
        
        // Check if user is authenticated
        if (!userId) {
            console.warn("No authenticated user found, using anonymous client");
            return createClient(supabaseUrl, supabaseAnonKey);
        }
        
        const token = await getToken();
        
        if (token) {
            // Create client with session token
            const client = createClient(supabaseUrl, supabaseAnonKey, {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                },
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            });
            
            // Test the connection
            try {
                const { data, error } = await client.auth.getUser();
                if (error) {
                    console.warn("Auth token may be invalid, using anonymous client:", error.message);
                    return createClient(supabaseUrl, supabaseAnonKey);
                }
                console.log("Authenticated client created successfully");
            } catch (testError) {
                console.warn("Failed to test authenticated client, using anonymous client:", testError);
                return createClient(supabaseUrl, supabaseAnonKey);
            }
            
            return client;
        } else {
            console.warn("No auth token available, using anonymous client");
            return createClient(supabaseUrl, supabaseAnonKey);
        }
    } catch (error) {
        console.warn("Failed to create authenticated client, using anonymous client:", error);
        return createClient(supabaseUrl, supabaseAnonKey);
    }
};