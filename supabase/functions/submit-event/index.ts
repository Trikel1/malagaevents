import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiting (resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3; // max submissions
const RATE_WINDOW = 3600000; // 1 hour in ms

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(email);
  
  if (!record || now > record.resetAt) {
    rateLimitMap.set(email, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  
  if (record.count >= RATE_LIMIT) {
    return true;
  }
  
  record.count++;
  return false;
}

interface EventSubmission {
  title: string;
  description: string;
  category: string;
  start_at: string;
  end_at?: string;
  venue_name: string;
  address: string;
  ticket_url?: string;
  price_info?: string;
  is_free: boolean;
  image_url?: string;
  age_restriction?: string;
  accessibility_info?: string;
  capacity_info?: string;
  tags?: string[];
  email: string;
}

function validateSubmission(data: EventSubmission): string | null {
  if (!data.title || data.title.length < 3 || data.title.length > 200) {
    return 'Title must be between 3 and 200 characters';
  }
  if (!data.description || data.description.length < 10 || data.description.length > 2000) {
    return 'Description must be between 10 and 2000 characters';
  }
  if (!data.category) {
    return 'Category is required';
  }
  if (!data.start_at) {
    return 'Start date is required';
  }
  if (!data.venue_name || data.venue_name.length < 2) {
    return 'Venue name is required';
  }
  if (!data.address || data.address.length < 5) {
    return 'Address is required';
  }
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return 'Valid email is required';
  }
  
  // Check for spam patterns
  const spamPatterns = [
    /\b(viagra|casino|lottery|winner|prize|free money)\b/i,
    /(.)\1{5,}/, // repeated characters
    /https?:\/\/[^\s]{100,}/, // very long URLs
  ];
  
  const textToCheck = `${data.title} ${data.description}`;
  for (const pattern of spamPatterns) {
    if (pattern.test(textToCheck)) {
      return 'Submission flagged as spam';
    }
  }
  
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const data: EventSubmission = await req.json();
    
    console.log('Received event submission:', { 
      title: data.title, 
      email: data.email,
      category: data.category 
    });

    // Validate submission
    const validationError = validateSubmission(data);
    if (validationError) {
      console.log('Validation failed:', validationError);
      return new Response(
        JSON.stringify({ success: false, error: validationError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting by email
    if (isRateLimited(data.email)) {
      console.log('Rate limited:', data.email);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Too many submissions. Please try again later.' 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate verification token
    const verificationToken = crypto.randomUUID();

    // Create the event with pending status
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        title: data.title,
        description: data.description,
        category: data.category,
        start_at: data.start_at,
        end_at: data.end_at || null,
        venue_name: data.venue_name,
        address: data.address,
        ticket_url: data.ticket_url || null,
        price_info: data.price_info || null,
        is_free: data.is_free,
        image_url: data.image_url || null,
        age_restriction: data.age_restriction || null,
        accessibility_info: data.accessibility_info || null,
        capacity_info: data.capacity_info || null,
        tags: data.tags || null,
        source_type: 'organizer_submission',
        status: 'pending', // Requires verification
      })
      .select()
      .single();

    if (eventError) {
      console.error('Error creating event:', eventError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create submission record for tracking
    const { error: submissionError } = await supabase
      .from('event_submissions')
      .insert({
        event_id: event.id,
        submitter_email: data.email,
        verification_token: verificationToken,
        captcha_passed: true, // We handle this client-side for now
        email_verified: false,
      });

    if (submissionError) {
      console.error('Error creating submission record:', submissionError);
      // Don't fail the request, the event was created
    }

    console.log('Event created successfully:', event.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventId: event.id,
        message: 'Event submitted successfully. It will be reviewed before publishing.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in submit-event:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
