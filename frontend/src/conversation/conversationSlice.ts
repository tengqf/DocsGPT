import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import store from '../store';
import { fetchAnswerApi, fetchAnswerSteaming } from './conversationApi';
import { Answer, ConversationState, Query, Status } from './conversationModels';
import { getConversations } from '../preferences/preferenceApi';
import { setConversations } from '../preferences/preferenceSlice';

const initialState: ConversationState = {
  queries: [],
  status: 'idle',
  conversationId: null,
};

const API_STREAMING = import.meta.env.VITE_API_STREAMING === 'true';

export const fetchAnswer = createAsyncThunk<Answer, { question: string }>(
  'fetchAnswer',
  async ({ question }, { dispatch, getState }) => {
    const state = getState() as RootState;
    if (state.preference) {
      if (API_STREAMING) {
        await fetchAnswerSteaming(
          question,
          state.preference.apiKey,
          state.preference.selectedDocs!,
          state.conversation.queries,
          state.conversation.conversationId,
          (event) => {
            const data = JSON.parse(event.data);

            // check if the 'end' event has been received
            if (data.type === 'end') {
              // set status to 'idle'
              dispatch(conversationSlice.actions.setStatus('idle'));
              getConversations()
                .then((fetchedConversations) => {
                  dispatch(setConversations(fetchedConversations));
                })
                .catch((error) => {
                  console.error('Failed to fetch conversations: ', error);
                });
            } else if (data.type === 'source') {
              // check if data.metadata exists
              let result;
              if (data.metadata && data.metadata.title) {
                const titleParts = data.metadata.title.split('/');
                result = {
                  title: titleParts[titleParts.length - 1],
                  text: data.doc,
                };
              } else {
                result = { title: data.doc, text: data.doc };
              }
              dispatch(
                updateStreamingSource({
                  index: state.conversation.queries.length - 1,
                  query: { sources: [result] },
                }),
              );
            } else if (data.type === 'id') {
              dispatch(
                updateConversationId({
                  query: { conversationId: data.id },
                }),
              );
            } else {
              const result = data.answer;
              dispatch(
                updateStreamingQuery({
                  index: state.conversation.queries.length - 1,
                  query: { response: result },
                }),
              );
            }
          },
        );
      } else {
        const answer = await fetchAnswerApi(
          question,
          state.preference.apiKey,
          state.preference.selectedDocs!,
          state.conversation.queries,
          state.conversation.conversationId,
        );
        if (answer) {
          let sourcesPrepped = [];
          sourcesPrepped = answer.sources.map((source: { title: string }) => {
            if (source && source.title) {
              const titleParts = source.title.split('/');
              return {
                ...source,
                title: titleParts[titleParts.length - 1],
              };
            }
            return source;
          });

          dispatch(
            updateQuery({
              index: state.conversation.queries.length - 1,
              query: { response: answer.answer, sources: sourcesPrepped },
            }),
          );
          dispatch(
            updateConversationId({
              query: { conversationId: answer.conversationId },
            }),
          );
          dispatch(conversationSlice.actions.setStatus('idle'));
          getConversations()
            .then((fetchedConversations) => {
              dispatch(setConversations(fetchedConversations));
            })
            .catch((error) => {
              console.error('Failed to fetch conversations: ', error);
            });
        }
      }
    }
    return {
      conversationId: null,
      title: null,
      answer: '',
      query: question,
      result: '',
      sources: [],
    };
  },
);

export const conversationSlice = createSlice({
  name: 'conversation',
  initialState,
  reducers: {
    addQuery(state, action: PayloadAction<Query>) {
      state.queries.push(action.payload);
    },
    setConversation(state, action: PayloadAction<Query[]>) {
      state.queries = action.payload;
    },
    updateStreamingQuery(
      state,
      action: PayloadAction<{ index: number; query: Partial<Query> }>,
    ) {
      const { index, query } = action.payload;
      if (query.response) {
        state.queries[index].response =
          (state.queries[index].response || '') + query.response;
      } else {
        state.queries[index] = {
          ...state.queries[index],
          ...query,
        };
      }
    },
    updateConversationId(
      state,
      action: PayloadAction<{ query: Partial<Query> }>,
    ) {
      state.conversationId = action.payload.query.conversationId ?? null;
    },
    updateStreamingSource(
      state,
      action: PayloadAction<{ index: number; query: Partial<Query> }>,
    ) {
      const { index, query } = action.payload;
      if (!state.queries[index].sources) {
        state.queries[index].sources = [query.sources![0]];
      } else {
        state.queries[index].sources!.push(query.sources![0]);
      }
    },
    updateQuery(
      state,
      action: PayloadAction<{ index: number; query: Partial<Query> }>,
    ) {
      const { index, query } = action.payload;
      state.queries[index] = {
        ...state.queries[index],
        ...query,
      };
    },
    setStatus(state, action: PayloadAction<Status>) {
      state.status = action.payload;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchAnswer.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchAnswer.rejected, (state, action) => {
        state.status = 'failed';
        state.queries[state.queries.length - 1].error =
          'Something went wrong. Please try again later.';
      });
  },
});

type RootState = ReturnType<typeof store.getState>;

export const selectQueries = (state: RootState) => state.conversation.queries;

export const selectStatus = (state: RootState) => state.conversation.status;

export const {
  addQuery,
  updateQuery,
  updateStreamingQuery,
  updateConversationId,
  updateStreamingSource,
  setConversation,
} = conversationSlice.actions;
export default conversationSlice.reducer;
