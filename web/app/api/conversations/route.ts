import { NextRequest, NextResponse } from "next/server";

// API route for managing conversations - for future phases
export async function GET(request: NextRequest) {
  try {
    // This will integrate with existing conversation-utils
    // For now, returning placeholder data

    const conversations = [
      {
        id: "1",
        title: "Welcome to ShikAI Web",
        timestamp: new Date().toISOString(),
        messageCount: 0,
      },
    ];

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Conversations API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title } = await request.json();

    // This will use existing conversation utilities in Phase 3
    const newConversation = {
      id: Date.now().toString(),
      title: title || "New Conversation",
      timestamp: new Date().toISOString(),
      messageCount: 0,
    };

    return NextResponse.json({ conversation: newConversation });
  } catch (error) {
    console.error("Create conversation API error:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
