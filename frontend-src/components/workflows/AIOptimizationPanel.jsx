import React, { useState, useEffect } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle2, Lightbulb, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { InvokeLLM } from '@/api/integrations';
import { WorkflowRun } from '@/api/entities';

export default function AIOptimizationPanel({ workflow, nodes, connections, onApplyOptimization }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [appliedSuggestions, setAppliedSuggestions] = useState([]);

  const { data: workflowRuns = [] } = useQuery({
    queryKey: ['workflowRuns', workflow?.id],
    queryFn: async () => {
      if (!workflow?.id) return [];
      return WorkflowRun.filter({ workflow_id: workflow.id });
    },
    enabled: !!workflow?.id,
  });

  const analyzeWorkflow = async () => {
    setIsAnalyzing(true);
    try {
      const workflowData = {
        name: workflow?.name || 'New Workflow',
        nodes: nodes.map(n => ({ id: n.id, type: n.type, name: n.name })),
        connections: connections.map(c => ({ from: c.from.nodeId, to: c.to })),
        historical_data: {
          total_runs: workflowRuns.length,
          success_rate: workflowRuns.length > 0 
            ? ((workflowRuns.filter(r => r.status === 'completed').length / workflowRuns.length) * 100).toFixed(1) 
            : 0,
          avg_duration: workflowRuns.filter(r => r.duration_minutes).reduce((sum, r) => sum + r.duration_minutes, 0) / (workflowRuns.filter(r => r.duration_minutes).length || 1),
          bottlenecks: workflowRuns.flatMap(r => r.bottleneck_steps || []),
        }
      };

      const response = await InvokeLLM({
        prompt: `As a workflow optimization expert, analyze this workflow structure and historical performance data:
        
        ${JSON.stringify(workflowData, null, 2)}
        
        Provide actionable optimization suggestions including:
        1. Wait time adjustments (too long/short delays)
        2. Missing conditional logic (where branches could improve outcomes)
        3. A/B testing opportunities (message variations, timing)
        4. Sequence improvements (reorder steps for better flow)
        5. Redundant steps that can be removed
        
        Return array of suggestions with: type, title, description, impact (high/medium/low), implementation (specific instructions), expected_improvement (percentage).`,
        response_json_schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  impact: { type: "string" },
                  implementation: { type: "string" },
                  expected_improvement: { type: "string" },
                  target_nodes: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            }
          }
        }
      });

      if (response?.suggestions) {
        setSuggestions(response.suggestions);
        toast.success(`Found ${response.suggestions.length} optimization opportunities`);
      }
    } catch (error) {
      toast.error('Failed to analyze workflow');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applySuggestion = (suggestion, index) => {
    onApplyOptimization(suggestion);
    setAppliedSuggestions(prev => [...prev, index]);
    toast.success('Optimization applied!');
  };

  const applyAllSuggestions = () => {
    const toApply = suggestions.filter((_, i) => !appliedSuggestions.includes(i));
    toApply.forEach((suggestion) => onApplyOptimization(suggestion));
    setAppliedSuggestions(suggestions.map((_, i) => i));
    toast.success(`Applied ${toApply.length} suggestion${toApply.length !== 1 ? 's' : ''}!`);
  };

  const impactColors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  const typeIcons = {
    timing: '⏱️',
    logic: '🔀',
    testing: '🧪',
    sequence: '🔄',
    optimization: '⚡',
  };

  return (
    <Card className="bg-[#1a1a1a] border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Sparkles size={20} className="text-[#cb6ce6]" />
            AI Optimization Suggestions
          </CardTitle>
          <div className="flex gap-2">
            {suggestions.length > 0 && appliedSuggestions.length < suggestions.length && (
              <Button
                onClick={applyAllSuggestions}
                size="sm"
                variant="outline"
                className="border-[#38b6ff]/50 text-[#38b6ff] hover:bg-[#38b6ff]/10"
              >
                Apply All
              </Button>
            )}
          <Button
            onClick={analyzeWorkflow}
            disabled={isAnalyzing || nodes.length < 2}
            size="sm"
            className="bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff]"
          >
            {isAnalyzing ? (
              <>
                <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin mr-2" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles size={14} className="mr-2" />
                Analyze Workflow
              </>
            )}
          </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <div className="text-center py-8">
            <Lightbulb className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              {nodes.length < 2 
                ? 'Add more nodes to get AI optimization suggestions' 
                : 'Click "Analyze Workflow" to get AI-powered optimization suggestions'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <div 
                key={index}
                className={`p-4 rounded-lg border transition-all ${
                  appliedSuggestions.includes(index) 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : 'bg-white/5 border-white/10 hover:border-[#38b6ff]/50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{typeIcons[suggestion.type] || '💡'}</span>
                    <h4 className="text-white font-medium">{suggestion.title}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${impactColors[suggestion.impact]}`}>
                      {suggestion.impact} impact
                    </span>
                    {appliedSuggestions.includes(index) && (
                      <CheckCircle2 size={16} className="text-green-400" />
                    )}
                  </div>
                </div>

                <p className="text-gray-400 text-sm mb-3">{suggestion.description}</p>

                <div className="bg-black/30 rounded-lg p-3 mb-3 border border-white/10">
                  <div className="text-xs text-gray-500 mb-1">Implementation:</div>
                  <p className="text-gray-300 text-sm">{suggestion.implementation}</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <TrendingUp size={14} />
                    <span>Expected improvement: {suggestion.expected_improvement}</span>
                  </div>
                  {!appliedSuggestions.includes(index) && (
                    <Button
                      onClick={() => applySuggestion(suggestion, index)}
                      size="sm"
                      className="bg-[#38b6ff] hover:bg-[#38b6ff]/80 gap-1"
                    >
                      Apply
                      <ArrowRight size={14} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {workflowRuns.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-blue-400 mt-0.5" />
              <div>
                <p className="text-blue-400 text-sm font-medium">Performance Data Available</p>
                <p className="text-gray-400 text-xs mt-1">
                  {workflowRuns.length} historical runs analyzed. Suggestions are based on real performance data.
                </p>
              </div>
            </div>
          </div>
    